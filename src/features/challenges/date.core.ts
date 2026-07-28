const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 86_400_000;

export type ChallengeDayStatus = "not_started" | "active" | "completed";

export type ChallengeDayInput = {
  personalStartDate: string;
  targetDate: string;
  durationDays: number;
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

export function calculateChallengeDay(input: ChallengeDayInput): ChallengeDayResult {
  if (!Number.isInteger(input.durationDays) || input.durationDays < 1) {
    throw new Error("durationDays precisa ser um inteiro positivo.");
  }

  const start = parseDateOnly(input.personalStartDate);
  const target = parseDateOnly(input.targetDate);
  const daysElapsed = Math.floor((target - start) / millisecondsPerDay);
  const dayNumber = daysElapsed + 1;

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
