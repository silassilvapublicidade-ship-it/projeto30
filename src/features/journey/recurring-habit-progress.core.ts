export type RecurringHabitFrequency = "daily" | "monthly" | "weekly";

export type RecurringHabitProgressInput = {
  completed: number;
  frequencyType: RecurringHabitFrequency;
  target: number | null;
};

const periodSuffix: Record<RecurringHabitFrequency, string> = {
  daily: "no ciclo",
  monthly: "este mês",
  weekly: "esta semana",
};

/**
 * "X de Y <período>" when there's a real target to compare against (every
 * weekly/monthly habit with validation_config.target, and every daily habit
 * against days lived so far). Falls back to a plain count when there's no
 * target (e.g. a monthly reading habit tracked as pure constância, not a
 * day-count goal) - never fabricates a denominator that isn't there.
 */
export function formatRecurringProgressLabel(input: RecurringHabitProgressInput): string {
  const suffix = periodSuffix[input.frequencyType];

  if (input.target === null) {
    return `${input.completed} ${input.completed === 1 ? "dia" : "dias"} ${suffix}`;
  }

  return `${input.completed} de ${input.target} ${suffix}`;
}

/**
 * Percent for the progress bar, capped at 100 even if completed somehow
 * exceeds target (e.g. an admin lowers a target after the fact) - never
 * renders a bar wider than its track. Null target means "no fraction to
 * show", callers should render the count without a bar in that case.
 */
export function computeRecurringProgressPercent(input: RecurringHabitProgressInput): number | null {
  if (input.target === null || input.target <= 0) {
    return null;
  }

  return Math.min(100, Math.round((input.completed / input.target) * 100));
}
