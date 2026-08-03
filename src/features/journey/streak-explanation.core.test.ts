import { describe, expect, it } from "vitest";

import { describeStreakOutcome } from "./streak-explanation.core";

describe("describeStreakOutcome", () => {
  it("reports the streak as met when completion is exactly at the minimum", () => {
    const result = describeStreakOutcome({
      completionPercent: 70,
      streakCurrent: 1,
      streakMinimumCompletion: 70,
    });
    expect(result.metMinimum).toBe(true);
    expect(result.message).toContain("1 dia");
  });

  it("pluralizes correctly for a streak of more than 1 day", () => {
    const result = describeStreakOutcome({
      completionPercent: 100,
      streakCurrent: 3,
      streakMinimumCompletion: 70,
    });
    expect(result.metMinimum).toBe(true);
    expect(result.message).toContain("3 dias");
  });

  it("explains the exact miss - matches the brief's own example wording", () => {
    const result = describeStreakOutcome({
      completionPercent: 50,
      streakCurrent: 0,
      streakMinimumCompletion: 70,
    });
    expect(result.metMinimum).toBe(false);
    expect(result.message).toBe(
      "Você concluiu 50% dos hábitos diários. A sequência exige 70%, por isso ela não avançou hoje.",
    );
  });

  it("never says 'sequência mantida' when the streak count is 0, even if the minimum was met (first log of an enrollment)", () => {
    const result = describeStreakOutcome({
      completionPercent: 100,
      streakCurrent: 0,
      streakMinimumCompletion: 70,
    });
    expect(result.metMinimum).toBe(true);
    expect(result.message).not.toContain("Sequência mantida");
  });

  it("this is the exact real-world regression case (Silas, Dia 2: 50% < 70%) - streak_current=0 is correct, not a bug", () => {
    const result = describeStreakOutcome({
      completionPercent: 50,
      streakCurrent: 0,
      streakMinimumCompletion: 70,
    });
    expect(result.metMinimum).toBe(false);
    expect(result.message).toContain("50%");
    expect(result.message).toContain("70%");
  });
});
