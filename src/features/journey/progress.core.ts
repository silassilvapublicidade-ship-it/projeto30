export type JourneyHabitStatus = "pending" | "completed" | "not_applicable" | "skipped";

export type DailyProgressState =
  "not_started" | "in_progress" | "partial" | "complete" | "finalized";

export type JourneyHabitFrequency = "daily" | "weekly" | "monthly";

export type JourneyHabitProgressInput = {
  habitId: string;
  /**
   * Defaults to "daily" when omitted, matching habits.frequency_type's
   * database default. Only daily habits count toward the day's
   * completion_percent - mirrors journey_recalculate_daily_log (migration
   * 0009), which excludes weekly/monthly habits from the day's
   * applicable/completed counts so an unfinished weekly or monthly goal
   * never blocks a "complete" day or the all-habits-done bonus.
   */
  frequencyType?: JourneyHabitFrequency;
  status: JourneyHabitStatus;
  touched?: boolean;
};

export type DailyProgressInput = {
  finalized: boolean;
  habits: JourneyHabitProgressInput[];
};

export type DailyProgressSummary = {
  applicableHabits: number;
  completedHabits: number;
  completionPercent: number;
  state: DailyProgressState;
};

function roundPercent(value: number) {
  return Math.round(value * 10_000) / 100;
}

function dedupeHabits(habits: JourneyHabitProgressInput[]) {
  const byId = new Map<string, JourneyHabitProgressInput>();

  for (const habit of habits) {
    const current = byId.get(habit.habitId);

    if (!current || habit.status === "completed") {
      byId.set(habit.habitId, {
        ...habit,
        touched: Boolean(habit.touched || habit.status !== "pending"),
      });
    }
  }

  return Array.from(byId.values());
}

export function calculateDailyProgress(input: DailyProgressInput): DailyProgressSummary {
  const dailyHabits = dedupeHabits(input.habits).filter(
    (habit) => (habit.frequencyType ?? "daily") === "daily",
  );
  const applicableHabits = dailyHabits.filter((habit) => habit.status !== "not_applicable");
  const completedHabits = applicableHabits.filter(
    (habit) => habit.status === "completed",
  );
  const touchedHabits = applicableHabits.filter((habit) => habit.touched);
  const completionPercent =
    applicableHabits.length === 0
      ? 100
      : roundPercent(completedHabits.length / applicableHabits.length);

  if (input.finalized) {
    return {
      applicableHabits: applicableHabits.length,
      completedHabits: completedHabits.length,
      completionPercent,
      state: "finalized",
    };
  }

  if (applicableHabits.length === 0 || completionPercent === 100) {
    return {
      applicableHabits: applicableHabits.length,
      completedHabits: completedHabits.length,
      completionPercent,
      state: "complete",
    };
  }

  if (completedHabits.length > 0) {
    return {
      applicableHabits: applicableHabits.length,
      completedHabits: completedHabits.length,
      completionPercent,
      state: "partial",
    };
  }

  if (touchedHabits.length > 0) {
    return {
      applicableHabits: applicableHabits.length,
      completedHabits: completedHabits.length,
      completionPercent,
      state: "in_progress",
    };
  }

  return {
    applicableHabits: applicableHabits.length,
    completedHabits: completedHabits.length,
    completionPercent,
    state: "not_started",
  };
}
