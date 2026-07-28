export type JourneyHabitStatus = "pending" | "completed" | "not_applicable" | "skipped";

export type DailyProgressState =
  "not_started" | "in_progress" | "partial" | "complete" | "finalized";

export type JourneyHabitProgressInput = {
  habitId: string;
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
  const habits = dedupeHabits(input.habits);
  const applicableHabits = habits.filter((habit) => habit.status !== "not_applicable");
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
