export type HabitLogStatus = "pending" | "completed" | "not_applicable" | "skipped";

export type RequiredHabitCheckInput = {
  habitId: string;
  required: boolean;
  status: HabitLogStatus | null | undefined;
};

export type FinalizeEligibility = {
  canFinalize: boolean;
  missingRequiredHabitIds: string[];
};

/**
 * Mirrors the guard added to public.finalize_daily_log() in
 * 0004_fix_finalize_daily_log.sql: a required habit only counts as done
 * when its status is exactly "completed" - not_applicable, skipped, or a
 * missing/pending log all block finalization.
 */
export function getFinalizeEligibility(
  habits: RequiredHabitCheckInput[],
): FinalizeEligibility {
  const missingRequiredHabitIds = habits
    .filter((habit) => habit.required && habit.status !== "completed")
    .map((habit) => habit.habitId);

  return {
    canFinalize: missingRequiredHabitIds.length === 0,
    missingRequiredHabitIds,
  };
}
