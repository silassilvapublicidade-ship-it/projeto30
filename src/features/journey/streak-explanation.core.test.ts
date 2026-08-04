import { describe, expect, it } from "vitest";

import { describeStreakBest, describeStreakOutcome } from "./streak-explanation.core";

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

describe("describeStreakBest - auditoria de produto, item 03 (streak_best now surfaced to the member)", () => {
  it("returns null when there is no record yet (brand-new enrollment, streak_best still 0)", () => {
    expect(describeStreakBest({ streakBest: 0, streakCurrent: 0 })).toBeNull();
  });

  it("says the user is currently AT their record when streakCurrent equals streakBest", () => {
    expect(describeStreakBest({ streakBest: 5, streakCurrent: 5 })).toBe("Este é o seu recorde: 5 dias.");
  });

  it("says the user is currently AT their record even when streakCurrent somehow exceeds the stored best (defensive - never crashes on an inconsistent read)", () => {
    expect(describeStreakBest({ streakBest: 3, streakCurrent: 4 })).toBe("Este é o seu recorde: 3 dias.");
  });

  it("references the earlier record when the current streak is below it", () => {
    expect(describeStreakBest({ streakBest: 12, streakCurrent: 1 })).toBe("Seu recorde: 12 dias.");
  });

  it("pluralizes 1 dia correctly, singular, at the record", () => {
    expect(describeStreakBest({ streakBest: 1, streakCurrent: 1 })).toBe("Este é o seu recorde: 1 dia.");
  });

  it("pluralizes 1 dia correctly, singular, below the record", () => {
    expect(describeStreakBest({ streakBest: 1, streakCurrent: 0 })).toBe("Seu recorde: 1 dia.");
  });
});
