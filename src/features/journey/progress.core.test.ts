import { describe, expect, it } from "vitest";

import { calculateDailyProgress } from "./progress.core";

describe("calculateDailyProgress", () => {
  it("calculates percentage from applicable habits only", () => {
    expect(
      calculateDailyProgress({
        finalized: false,
        habits: [
          { habitId: "water", status: "completed" },
          { habitId: "reading", status: "pending" },
          { habitId: "rest", status: "not_applicable" },
        ],
      }),
    ).toEqual({
      applicableHabits: 2,
      completedHabits: 1,
      completionPercent: 50,
      state: "partial",
    });
  });

  it("marks a touched day as in progress before a habit is completed", () => {
    expect(
      calculateDailyProgress({
        finalized: false,
        habits: [{ habitId: "minutes", status: "pending", touched: true }],
      }).state,
    ).toBe("in_progress");
  });

  it("marks the day as finalized without changing its percentage", () => {
    expect(
      calculateDailyProgress({
        finalized: true,
        habits: [
          { habitId: "water", status: "completed" },
          { habitId: "reading", status: "pending" },
        ],
      }),
    ).toMatchObject({
      completionPercent: 50,
      state: "finalized",
    });
  });

  it("deduplicates a habit and keeps the completed state authoritative", () => {
    expect(
      calculateDailyProgress({
        finalized: false,
        habits: [
          { habitId: "reading", status: "pending", touched: true },
          { habitId: "reading", status: "completed" },
        ],
      }),
    ).toMatchObject({
      applicableHabits: 1,
      completedHabits: 1,
      completionPercent: 100,
      state: "complete",
    });
  });
});
