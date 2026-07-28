import { describe, expect, it } from "vitest";

import { getUnlockedAchievementSlugs } from "../achievements/achievements.core";
import { calculateChallengeDay } from "../challenges/date.core";
import { calculateDailyPointSummary } from "../points/points.core";
import { calculateStreak } from "../streaks/streaks.core";

import { calculateDailyProgress } from "./progress.core";

describe("daily journey workflow", () => {
  it("creates an enrollment day, loads progress, finalizes once and unlocks milestones", () => {
    const enrollment = {
      id: "enrollment-1",
      personalStartDate: "2026-07-01",
      durationDays: 10,
    };
    const challengeDay = calculateChallengeDay({
      durationDays: enrollment.durationDays,
      personalStartDate: enrollment.personalStartDate,
      targetDate: "2026-07-01",
    });

    expect(challengeDay).toMatchObject({ dayNumber: 1, status: "active" });

    const progress = calculateDailyProgress({
      finalized: false,
      habits: [
        { habitId: "reading", status: "completed" },
        { habitId: "training", status: "completed" },
      ],
    });

    expect(progress).toMatchObject({
      applicableHabits: 2,
      completedHabits: 2,
      completionPercent: 100,
      state: "complete",
    });

    const points = calculateDailyPointSummary({
      allHabitsBonusPoints: 30,
      dayNumber: challengeDay.dayNumber,
      enrollmentId: enrollment.id,
      finalizeDayBonusPoints: 10,
      finalized: true,
      habits: [
        { habitId: "reading", points: 10, status: "completed" },
        { habitId: "training", points: 15, status: "completed" },
      ],
      reflectionCompleted: true,
      reflectionPoints: 10,
    });

    expect(points.totalPoints).toBe(75);
    expect(new Set(points.events.map((event) => event.idempotencyKey)).size).toBe(
      points.events.length,
    );

    const duplicateFinalize = calculateDailyPointSummary({
      allHabitsBonusPoints: 30,
      dayNumber: challengeDay.dayNumber,
      enrollmentId: enrollment.id,
      finalizeDayBonusPoints: 10,
      finalized: true,
      habits: [
        { habitId: "reading", points: 10, status: "completed" },
        { habitId: "training", points: 15, status: "completed" },
      ],
      reflectionCompleted: true,
      reflectionPoints: 10,
    });

    expect(duplicateFinalize.events.map((event) => event.idempotencyKey)).toEqual(
      points.events.map((event) => event.idempotencyKey),
    );

    const streak = calculateStreak({
      dayQualifies: progress.completionPercent >= 70,
      lastValidLogDate: null,
      logDate: "2026-07-01",
      previousBest: 0,
      previousCurrent: 0,
    });

    expect(streak).toMatchObject({ best: 1, current: 1 });

    const achievements = getUnlockedAchievementSlugs({
      completedCycle: false,
      completedHabitsLifetime: progress.completedHabits,
      durationDays: enrollment.durationDays,
      finalizedDays: 1,
      physicalActivityCompletions: 1,
      readingCompletions: 1,
      reflectionDays: 1,
      returnStrong: false,
      streakCurrent: streak.current,
    });

    expect(achievements.unlockedSlugs).toEqual(["primeiro-habito", "primeiro-dia"]);
  });
});
