const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 86_400_000;

export type ChallengeDayStatus = "not_started" | "active" | "completed";

export type ChallengeDayInput = {
  personalStartDate: string;
  targetDate: string;
  durationDays: number;
  /** Cumulative whole days credited back by a pause (whole-challenge or
   * this specific enrollment), mirroring journey_calculate_day's SQL
   * counterpart exactly so the UI's day number never disagrees with what
   * the RPC actually computed/enforced. Defaults to 0 - a no-op, so every
   * existing (never-paused) caller is unaffected. */
  pausedDaysOffset?: number;
};

export type ChallengeDayResult = {
  dayNumber: number;
  status: ChallengeDayStatus;
  daysElapsed: number;
};

function parseDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) {
    throw new Error(`Data inválida: ${value}. Use YYYY-MM-DD.`);
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Data inválida: ${value}.`);
  }

  return Date.UTC(year, month - 1, day);
}

export function getDateOnlyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Não foi possível calcular a data no fuso ${timeZone}.`);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Formats a UTC-midnight timestamp (as produced by parseDateOnly's own
 * arithmetic) back into the same YYYY-MM-DD shape every date-only value in
 * this codebase uses - never delegates to a Date's own local getters, which
 * would reintroduce the timezone bug this file's own getDateOnlyInTimeZone
 * exists to avoid.
 */
function formatDateOnly(utcMillis: number): string {
  const date = new Date(utcMillis);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The calendar day immediately before the given date-only string - used
 * for day-over-day comparisons (e.g. "hoje você fez mais que ontem"),
 * never for challenge-day-number math (that stays exclusively in
 * calculateChallengeDay). */
export function getPreviousDateOnly(dateOnly: string): string {
  return formatDateOnly(parseDateOnly(dateOnly) - millisecondsPerDay);
}

export function calculateChallengeDay(input: ChallengeDayInput): ChallengeDayResult {
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1) {
    throw new Error("durationDays precisa ser um inteiro positivo.");
  }

  const start = parseDateOnly(input.personalStartDate);
  const target = parseDateOnly(input.targetDate);
  const daysElapsed = Math.floor((target - start) / millisecondsPerDay);
  const dayNumber = daysElapsed + 1 - (input.pausedDaysOffset ?? 0);

  if (dayNumber < 1) {
    return {
      dayNumber: 0,
      daysElapsed,
      status: "not_started",
    };
  }

  if (dayNumber > input.durationDays) {
    return {
      dayNumber: input.durationDays,
      daysElapsed,
      status: "completed",
    };
  }

  return {
    dayNumber,
    daysElapsed,
    status: "active",
  };
}
