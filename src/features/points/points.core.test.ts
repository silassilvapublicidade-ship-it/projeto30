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

  it("reaches the August challenge minimum of 160 when optionals are not_applicable", () => {
    const requiredHabits = Array.from({ length: 11 }, (_, index) => ({
      habitId: `required-${index}`,
      points: 10,
      status: "completed" as const,
    }));

    const summary = calculateDailyPointSummary({
      enrollmentId: "enrollment-1",
      dayNumber: 1,
      finalized: true,
      reflectionCompleted: true,
      reflectionPoints: 10,
      finalizeDayBonusPoints: 10,
      allHabitsBonusPoints: 30,
      habits: [
        ...requiredHabits,
        { habitId: "optional-1", points: 10, status: "not_applicable" },
        { habitId: "optional-2", points: 10, status: "not_applicable" },
      ],
    });

    expect(summary.applicableHabits).toBe(11);
    expect(summary.completedHabits).toBe(11);
    expect(summary.totalPoints).toBe(160);
  });

  it("reaches the August challenge maximum of 180 when every habit is completed", () => {
    const allHabits = Array.from({ length: 13 }, (_, index) => ({
      habitId: `habit-${index}`,
      points: 10,
      status: "completed" as const,
    }));

    const summary = calculateDailyPointSummary({
      enrollmentId: "enrollment-1",
      dayNumber: 1,
      finalized: true,
      reflectionCompleted: true,
      reflectionPoints: 10,
      finalizeDayBonusPoints: 10,
      allHabitsBonusPoints: 30,
      habits: allHabits,
    });

    expect(summary.totalPoints).toBe(180);
  });

  it("does not award the 100% bonus when an optional habit is only pending", () => {
    const requiredHabits = Array.from({ length: 11 }, (_, index) => ({
      habitId: `required-${index}`,
      points: 10,
      status: "completed" as const,
    }));

    const summary = calculateDailyPointSummary({
      enrollmentId: "enrollment-1",
      dayNumber: 1,
      finalized: true,
      reflectionCompleted: true,
      reflectionPoints: 10,
      finalizeDayBonusPoints: 10,
      allHabitsBonusPoints: 30,
      habits: [
        ...requiredHabits,
        { habitId: "optional-1", points: 10, status: "pending" },
        { habitId: "optional-2", points: 10, status: "not_applicable" },
      ],
    });

    // The untouched optional still counts as applicable (only
    // not_applicable is excluded), so completed (11) < applicable (12) and
    // the bonus does not fire: 110 (required) + 10 (reflection) + 10 (finalize) = 130.
    expect(summary.applicableHabits).toBe(12);
    expect(summary.completedHabits).toBe(11);
    expect(summary.totalPoints).toBe(130);
  });
});
