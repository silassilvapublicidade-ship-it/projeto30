export type JourneyDayState = "completed" | "future" | "missed" | "partial" | "today";

/**
 * Pure classification for one calendar cell in the Jornada view. Never
 * depends on wall-clock time directly - todayDayNumber is always the
 * already-computed "day vigente" for this specific enrollment, so a day
 * from a different challenge can never leak into this comparison.
 */
export function getJourneyDayState({
  completionPercent,
  dayNumber,
  finalized,
  hasLog,
  todayDayNumber,
}: {
  completionPercent: number;
  dayNumber: number;
  finalized: boolean;
  hasLog: boolean;
  todayDayNumber: number;
}): JourneyDayState {
  if (dayNumber === todayDayNumber) {
    return "today";
  }

  if (dayNumber > todayDayNumber) {
    return "future";
  }

  if (finalized && completionPercent >= 100) {
    return "completed";
  }

  if (finalized && completionPercent > 0) {
    return "partial";
  }

  if (hasLog && !finalized) {
    return "partial";
  }

  return "missed";
}
