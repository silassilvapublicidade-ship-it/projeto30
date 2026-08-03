export type JourneyDayState =
  | "completed"
  | "future"
  | "not_finalized"
  | "partial_kept"
  | "partial_lost"
  | "today";

/**
 * Pure classification for one calendar cell in the Jornada view. Never
 * depends on wall-clock time directly - todayDayNumber is always the
 * already-computed "day vigente" for this specific enrollment, so a day
 * from a different challenge can never leak into this comparison.
 *
 * Root cause fixed here (real production case: Silas's Dia 2, finalized at
 * 50%): "finalized" and "completion percent" are different axes and must
 * never collapse into one bucket. Before this fix, every finalized day
 * below 100% - including one finalized at exactly 0% - mapped to the same
 * state as a day that was NEVER opened at all ("missed"/"partial", neither
 * of which said "finalizado" anywhere). A finalized day, at any
 * completion percent, is always "finalizado" - it just also separately
 * either kept the streak (>= streakMinimumCompletion) or didn't. A day
 * that was opened but never finalized (or never opened at all) is the only
 * thing that should ever read as "não finalizado".
 */
export function getJourneyDayState({
  completionPercent,
  dayNumber,
  finalized,
  streakMinimumCompletion,
  todayDayNumber,
}: {
  completionPercent: number;
  dayNumber: number;
  finalized: boolean;
  streakMinimumCompletion: number;
  todayDayNumber: number;
}): JourneyDayState {
  if (dayNumber === todayDayNumber) {
    return "today";
  }

  if (dayNumber > todayDayNumber) {
    return "future";
  }

  if (!finalized) {
    return "not_finalized";
  }

  if (completionPercent >= 100) {
    return "completed";
  }

  return completionPercent >= streakMinimumCompletion ? "partial_kept" : "partial_lost";
}
