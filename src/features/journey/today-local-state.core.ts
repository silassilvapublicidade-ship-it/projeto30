/**
 * Client-only editing state for the Hoje screen. Nothing here ever talks to
 * the network - every mark/unmark/comment is a pure state transition, and
 * the only place this state leaves the browser is the single finalize
 * payload (see today-responses.core.ts). This intentionally has a richer
 * vocabulary than the database: "pending" (never touched) and
 * "not_realized" (explicitly marked "não realizado") both persist as the
 * same DB status ('pending') once finalized - the distinction only exists
 * so the pending-confirmation modal can warn about genuinely untouched
 * habits without re-litigating ones the member already answered "no" to.
 */
export type LocalHabitStatus = "completed" | "not_applicable" | "not_realized" | "pending";

export type LocalHabitFrequency = "daily" | "monthly" | "weekly";

export type LocalHabitEntry = {
  frequencyType: LocalHabitFrequency;
  note: string;
  required: boolean;
  status: LocalHabitStatus;
};

export type LocalHabitsState = Record<string, LocalHabitEntry>;

export type SourceMissionState =
  | "completed"
  | "in_progress"
  | "not_applicable"
  | "pending"
  | "skipped";

export type SourceMission = {
  frequencyType: LocalHabitFrequency;
  habitId: string;
  note: string | null;
  required: boolean;
  state: SourceMissionState;
};

function fromSourceState(state: SourceMissionState): LocalHabitStatus {
  if (state === "completed") {
    return "completed";
  }

  if (state === "not_applicable") {
    return "not_applicable";
  }

  // "in_progress" (a leftover quantity/duration value_json from before the
  // yes/no simplification) and "skipped" (never produced by this UI) both
  // read as untouched here - there is nothing this editor lets the member
  // do that would distinguish them from "pending" going forward.
  return "pending";
}

/**
 * Seeds local state from whatever is already persisted - a day opened for
 * the first time (everything pending), a day the member is mid-editing
 * under the OLD per-click architecture before this shipped (some habits
 * already completed/noted), or a day that's already finalized (read-only,
 * see isReadOnlyState below). Never fabricates data: a habit with no prior
 * habit_logs row is exactly "pending", not "not_realized" - only an
 * explicit local action (or a prior explicit not_applicable) produces
 * anything else.
 */
export function buildInitialLocalState(missions: SourceMission[]): LocalHabitsState {
  const state: LocalHabitsState = {};

  for (const mission of missions) {
    state[mission.habitId] = {
      frequencyType: mission.frequencyType,
      note: mission.note ?? "",
      required: mission.required,
      status: fromSourceState(mission.state),
    };
  }

  return state;
}

export function setHabitStatus(
  state: LocalHabitsState,
  habitId: string,
  status: LocalHabitStatus,
): LocalHabitsState {
  const entry = state[habitId];

  if (!entry) {
    return state;
  }

  // Mirrors the server-side coercion in finalize_daily_log_with_responses:
  // a required habit can never go to "not_applicable" locally either - kept
  // here too so the button never even offers an inconsistent state, not
  // just so the eventual save doesn't silently rewrite what the UI showed.
  const nextStatus = status === "not_applicable" && entry.required ? "pending" : status;

  if (entry.status === nextStatus) {
    return state;
  }

  return { ...state, [habitId]: { ...entry, status: nextStatus } };
}

export function setHabitNote(state: LocalHabitsState, habitId: string, note: string): LocalHabitsState {
  const entry = state[habitId];

  if (!entry || entry.note === note) {
    return state;
  }

  return { ...state, [habitId]: { ...entry, note } };
}

/**
 * Deep-equal against the baseline captured at load time - the only correct
 * way to know whether there's anything to warn about on exit, since a
 * member can toggle a habit back to its original state and effectively
 * have "no changes" again.
 */
export function hasUnsavedChanges(state: LocalHabitsState, baseline: LocalHabitsState): boolean {
  const habitIds = Object.keys(state);

  if (habitIds.length !== Object.keys(baseline).length) {
    return true;
  }

  return habitIds.some((habitId) => {
    const current = state[habitId];
    const original = baseline[habitId];
    return !original || current?.status !== original.status || current.note !== original.note;
  });
}

/**
 * Only "pending" (never touched, never explicitly resolved) counts as a
 * real pendency for the confirmation modal - "not_realized" is already an
 * answer, "not_applicable" is already an answer, "completed" obviously is.
 */
export function countPendingHabits(state: LocalHabitsState): number {
  return Object.values(state).filter((entry) => entry.status === "pending").length;
}

export function isReadOnlyState(finalized: boolean): boolean {
  return finalized;
}

export type ProgressHabitInput = {
  frequencyType: LocalHabitFrequency;
  habitId: string;
  status: "completed" | "not_applicable" | "pending" | "skipped";
  touched: boolean;
};

/**
 * Feeds calculateDailyProgress (progress.core.ts) so the progress bar,
 * habit count and completion state update the instant a local mark
 * changes - no server round trip, same pure formula the server-rendered
 * baseline already used on first load. "not_realized" maps to "pending"
 * (it was never a real DB status, see LocalHabitStatus) but stays
 * "touched", so a day where the member has already answered "não" to a few
 * habits reads as "em movimento", not "aberto".
 */
export function toProgressInput(state: LocalHabitsState): ProgressHabitInput[] {
  return Object.entries(state).map(([habitId, entry]) => ({
    frequencyType: entry.frequencyType,
    habitId,
    status: entry.status === "not_realized" ? "pending" : entry.status,
    touched: entry.status !== "pending" || entry.note.trim().length > 0,
  }));
}

export type FinalizeResponseItem = {
  habit_id: string;
  note: string | null;
  status: "completed" | "not_applicable" | "pending";
};

/**
 * The wire payload sent to finalize_daily_log_with_responses. "not_realized"
 * collapses into "pending" here - the RPC treats them identically (neither
 * counts as completed, neither scores points), the distinction was purely a
 * client affordance for the pending-confirmation modal.
 */
export function buildFinalizeResponses(state: LocalHabitsState): FinalizeResponseItem[] {
  return Object.entries(state).map(([habitId, entry]) => ({
    habit_id: habitId,
    note: entry.note.trim() ? entry.note.trim() : null,
    status: entry.status === "not_realized" ? "pending" : entry.status,
  }));
}
