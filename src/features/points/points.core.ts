export type HabitPointStatus = "pending" | "completed" | "not_applicable" | "skipped";

export type HabitPointInput = {
  habitId: string;
  points: number;
  status: HabitPointStatus;
};

export type DailyPointInput = {
  enrollmentId: string;
  dayNumber: number;
  habits: HabitPointInput[];
  reflectionCompleted: boolean;
  finalized: boolean;
  reflectionPoints: number;
  finalizeDayBonusPoints: number;
  allHabitsBonusPoints: number;
};

export type PointEventDraft = {
  sourceType: "habit" | "reflection" | "day_finalized" | "all_habits_completed";
  sourceId: string;
  points: number;
  idempotencyKey: string;
};

export type DailyPointSummary = {
  applicableHabits: number;
  completedHabits: number;
  completionPercent: number;
  habitPoints: number;
  bonusPoints: number;
  totalPoints: number;
  events: PointEventDraft[];
};

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} precisa ser um inteiro não negativo.`);
  }
}

function pointEventKey(input: DailyPointInput, sourceType: string, sourceId: string) {
  return `${input.enrollmentId}:day-${input.dayNumber}:${sourceType}:${sourceId}`;
}

function dedupeHabits(habits: HabitPointInput[]) {
  const byId = new Map<string, HabitPointInput>();

  for (const habit of habits) {
    assertNonNegativeInteger(habit.points, `points:${habit.habitId}`);

    const current = byId.get(habit.habitId);

    if (!current || habit.status === "completed") {
      byId.set(habit.habitId, habit);
    }
  }

  return Array.from(byId.values());
}

export function calculateDailyPointSummary(input: DailyPointInput): DailyPointSummary {
  assertNonNegativeInteger(input.dayNumber, "dayNumber");
  assertNonNegativeInteger(input.reflectionPoints, "reflectionPoints");
  assertNonNegativeInteger(input.finalizeDayBonusPoints, "finalizeDayBonusPoints");
  assertNonNegativeInteger(input.allHabitsBonusPoints, "allHabitsBonusPoints");

  const habits = dedupeHabits(input.habits);
  const applicableHabits = habits.filter((habit) => habit.status !== "not_applicable");
  const completedHabits = applicableHabits.filter(
    (habit) => habit.status === "completed",
  );
  const habitEvents = completedHabits.map<PointEventDraft>((habit) => ({
    sourceId: habit.habitId,
    sourceType: "habit",
    points: habit.points,
    idempotencyKey: pointEventKey(input, "habit", habit.habitId),
  }));
  const habitPoints = habitEvents.reduce((total, event) => total + event.points, 0);
  const completionPercent =
    applicableHabits.length === 0
      ? 100
      : Math.round((completedHabits.length / applicableHabits.length) * 10_000) / 100;
  const bonusEvents: PointEventDraft[] = [];

  if (input.reflectionCompleted && input.reflectionPoints > 0) {
    bonusEvents.push({
      sourceId: `day-${input.dayNumber}`,
      sourceType: "reflection",
      points: input.reflectionPoints,
      idempotencyKey: pointEventKey(input, "reflection", `day-${input.dayNumber}`),
    });
  }

  if (input.finalized && input.finalizeDayBonusPoints > 0) {
    bonusEvents.push({
      sourceId: `day-${input.dayNumber}`,
      sourceType: "day_finalized",
      points: input.finalizeDayBonusPoints,
      idempotencyKey: pointEventKey(input, "day_finalized", `day-${input.dayNumber}`),
    });
  }

  if (
    input.finalized &&
    applicableHabits.length > 0 &&
    completedHabits.length === applicableHabits.length &&
    input.allHabitsBonusPoints > 0
  ) {
    bonusEvents.push({
      sourceId: `day-${input.dayNumber}`,
      sourceType: "all_habits_completed",
      points: input.allHabitsBonusPoints,
      idempotencyKey: pointEventKey(
        input,
        "all_habits_completed",
        `day-${input.dayNumber}`,
      ),
    });
  }

  const bonusPoints = bonusEvents.reduce((total, event) => total + event.points, 0);
  const events = [...habitEvents, ...bonusEvents];

  return {
    applicableHabits: applicableHabits.length,
    completedHabits: completedHabits.length,
    completionPercent,
    habitPoints,
    bonusPoints,
    totalPoints: habitPoints + bonusPoints,
    events,
  };
}
