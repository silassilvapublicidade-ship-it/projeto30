export type HabitPeriodFrequency = "monthly" | "weekly";

export type HabitPeriodRange = {
  end: string;
  start: string;
};

function parseDateOnly(dateOnly: string) {
  const parts = dateOnly.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Period boundaries (inclusive, both ends) for a weekly/monthly habit goal
 * that contains `localDate`. Weeks run Monday-Sunday. Both bounds are
 * "date only" strings (YYYY-MM-DD) in the same calendar used for
 * challenge_days/daily_logs (no time-of-day component).
 */
export function getHabitPeriodRange(
  localDate: string,
  frequencyType: HabitPeriodFrequency,
): HabitPeriodRange {
  const date = parseDateOnly(localDate);

  if (frequencyType === "monthly") {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    return { end: formatDateOnly(end), start: formatDateOnly(start) };
  }

  const dayOfWeek = date.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { end: formatDateOnly(end), start: formatDateOnly(start) };
}
