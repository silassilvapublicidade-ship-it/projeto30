export type HabitFrequencyType = "daily" | "monthly" | "weekly";

type ValidationConfigLike = {
  short_title?: string | undefined;
  target?: number | undefined;
  unit?: string | undefined;
};

function readValidationConfig(value: unknown): ValidationConfigLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const shortTitle = source.short_title;
  const target = source.target;
  const unit = source.unit;

  return {
    short_title: typeof shortTitle === "string" && shortTitle.trim() ? shortTitle.trim() : undefined,
    target: typeof target === "number" && Number.isFinite(target) ? target : undefined,
    unit: typeof unit === "string" && unit.trim() ? unit.trim() : undefined,
  };
}

/**
 * The question the member actually answers for THIS day - never the
 * aggregate goal. habits.daily_prompt is the authored source of truth
 * (curated per habit, e.g. "Bebeu pelo menos 3 litros de água hoje?"); a
 * habit created without one (nothing enforces daily_prompt at the DB level)
 * falls back to short_title, then to the raw title, so a new habit never
 * renders as an empty heading - just a less polished one until an admin
 * fills it in.
 */
export function resolveDailyPrompt(habit: {
  daily_prompt: string | null;
  title: string;
  validation_config?: unknown;
}): string {
  if (habit.daily_prompt?.trim()) {
    return habit.daily_prompt.trim();
  }

  const config = readValidationConfig(habit.validation_config);
  const base = config.short_title ?? habit.title;
  return `${base} hoje?`;
}

const frequencyGoalLabel: Record<HabitFrequencyType, string> = {
  daily: "Meta diária",
  monthly: "Meta mensal",
  weekly: "Meta semanal",
};

/**
 * The aggregate goal, always secondary to resolveDailyPrompt - "Meta
 * semanal: 4 sessões", never the primary label. Returns null when there's
 * no target to show (e.g. a plain daily yes/no habit with nothing to
 * quantify), so callers can skip rendering the line entirely instead of
 * showing an empty "Meta diária:".
 */
export function resolveGoalLabel(habit: {
  frequency_type: HabitFrequencyType;
  validation_config?: unknown;
}): string | null {
  const config = readValidationConfig(habit.validation_config);

  if (config.target === undefined) {
    return null;
  }

  const unit = config.unit?.toLowerCase();
  const suffix = unit ? `${config.target} ${unit}` : String(config.target);

  return `${frequencyGoalLabel[habit.frequency_type]}: ${suffix}`;
}
