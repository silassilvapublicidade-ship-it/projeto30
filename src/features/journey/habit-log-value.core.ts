export type HabitLogStatus = "completed" | "not_applicable" | "pending" | "skipped";

/**
 * The Hoje UI is feito/nao-feito only - no quantity/duration number input is
 * shown to the user. habits.habit_type 'quantity'/'duration' still require a
 * numeric value_json.value in the database to be marked completed
 * (update_habit_log rejects completing them without one); this is the
 * minimal placeholder that satisfies that constraint without ever asking
 * the user to type a number. Any other status keeps an empty value_json,
 * matching what update_habit_log itself forces for boolean/reading/
 * not_applicable/skipped regardless of what's sent.
 */
export function resolveHabitLogValueJson(status: HabitLogStatus): Record<string, unknown> {
  return status === "completed" ? { value: 1 } : {};
}
