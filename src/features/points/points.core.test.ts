import { describe, expect, it } from "vitest";

import { calculateDailyPointSummary } from "./points.core";

describe("calculateDailyPointSummary", () => {
  it("calculates habit, reflection and completion points", () => {
    const summary = calculateDailyPointSummary({
      enrollmentId: "enrollment-1",
      dayNumber: 7,
      finalized: true,
      reflectionCompleted: true,
      reflectionPoints: 10,
      finalizeDayBonusPoints: 10,
      allHabitsBonusPoints: 30,
      habits: [
        { habitId: "reading", points: 10, status: "completed" },
        { habitId: "training", points: 15, status: "completed" },
      ],
    });

    expect(summary).toMatchObject({
      applicableHabits: 2,
      completedHabits: 2,
      completionPercent: 100,
      habitPoints: 25,
      bonusPoints: 50,
      totalPoints: 75,
    });
    expect(summary.events).toHaveLength(5);
  });

  it("does not double count duplicated completed habits", () => {
    const summary = calculateDailyPointSummary({
      enrollmentId: "enrollment-1",
      dayNumber: 1,
      finalized: false,
      reflectionCompleted: false,
      reflectionPoints: 10,
      finalizeDayBonusPoints: 10,
      allHabitsBonusPoints: 30,
      habits: [
        { habitId: "water", points: 10, status: "completed" },
        { habitId: "water", points: 10, status: "completed" },
      ],
    });

    expect(summary.habitPoints).toBe(10);
    expect(summary.events).toHaveLength(1);
  });

  it("does not award all-habits bonus for partial days", () => {
    const summary = calculateDailyPointSummary({
      enrollmentId: "enrollment-1",
      dayNumber: 3,
      finalized: true,
      reflectionCompleted: false,
      reflectionPoints: 10,
      finalizeDayBonusPoints: 10,
      allHabitsBonusPoints: 30,
      habits: [
        { habitId: "reading", points: 10, status: "completed" },
        { habitId: "training", points: 15, status: "pending" },
      ],
    });

    expect(summary.completionPercent).toBe(50);
    expect(summary.totalPoints).toBe(20);
    expect(summary.events.map((event) => event.sourceType)).not.toContain(
      "all_habits_completed",
    );
  });
});
