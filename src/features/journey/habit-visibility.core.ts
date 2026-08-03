import type { Json } from "@/types/database";

export type HabitVisibilityType =
  | "all_days"
  | "between_days"
  | "first_day"
  | "from_day"
  | "last_day"
  | "specific_days";

export type HabitVisibilityConfig =
  | { type: "all_days" }
  | { type: "first_day" }
  | { type: "last_day" }
  | { day: number; type: "from_day" }
  | { from: number; to: number; type: "between_days" }
  | { days: number[]; type: "specific_days" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * TS mirror of public.habit_visible_on_day (migration 0050) - same 6 types,
 * same "unknown type falls back to visible" safety net. Kept in sync by
 * hand (no shared runtime between Postgres and the client). This is a
 * SECOND opinion only, never the source of truth: the server (finalize +
 * journey_recalculate_daily_log) always re-derives visibility itself and
 * never trusts what the client decided to render.
 */
export function isHabitVisibleOnDay(
  visibilityConfig: Json,
  dayNumber: number,
  durationDays: number,
): boolean {
  if (!isRecord(visibilityConfig)) {
    return true;
  }

  const type = visibilityConfig.type;

  switch (type) {
    case "all_days":
      return true;
    case "first_day":
      return dayNumber === 1;
    case "last_day":
      return dayNumber === durationDays;
    case "from_day": {
      const day = visibilityConfig.day;
      return typeof day === "number" && dayNumber >= day;
    }
    case "between_days": {
      const from = visibilityConfig.from;
      const to = visibilityConfig.to;
      return typeof from === "number" && typeof to === "number" && dayNumber >= from && dayNumber <= to;
    }
    case "specific_days": {
      const days = visibilityConfig.days;
      return Array.isArray(days) && days.includes(dayNumber);
    }
    default:
      return true;
  }
}

const VISIBILITY_LABELS: Record<HabitVisibilityType, string> = {
  all_days: "Todos os dias",
  between_days: "Entre dois dias",
  first_day: "Somente no primeiro dia",
  from_day: "A partir de um dia",
  last_day: "Somente no último dia",
  specific_days: "Dias específicos",
};

export function describeHabitVisibility(visibilityConfig: Json, durationDays: number): string {
  if (!isRecord(visibilityConfig)) {
    return VISIBILITY_LABELS.all_days;
  }

  const type = visibilityConfig.type;

  switch (type) {
    case "first_day":
      return "Aparece no Dia 1";
    case "last_day":
      return `Aparece no Dia ${durationDays}`;
    case "from_day":
      return typeof visibilityConfig.day === "number"
        ? `Aparece a partir do Dia ${visibilityConfig.day}`
        : VISIBILITY_LABELS.from_day;
    case "between_days":
      return typeof visibilityConfig.from === "number" && typeof visibilityConfig.to === "number"
        ? `Aparece entre os dias ${visibilityConfig.from} e ${visibilityConfig.to}`
        : VISIBILITY_LABELS.between_days;
    case "specific_days":
      return Array.isArray(visibilityConfig.days)
        ? `Aparece n${visibilityConfig.days.length === 1 ? "o" : "os"} dia${visibilityConfig.days.length === 1 ? "" : "s"} ${visibilityConfig.days.join(", ")}`
        : VISIBILITY_LABELS.specific_days;
    default:
      return VISIBILITY_LABELS.all_days;
  }
}
