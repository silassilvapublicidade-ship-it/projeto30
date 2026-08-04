import { describe, expect, it } from "vitest";

import { buildNarrativeSummary } from "./dashboard-narrative-summary.core";

describe("buildNarrativeSummary", () => {
  it("builds the exact sentence shape from the brief, with correct plurals", () => {
    const result = buildNarrativeSummary({
      achievementsUnlocked: 3,
      daysFinalized: 3,
      pointsTotal: 390,
      streakCurrent: 1,
      todayFinalized: false,
    });
    expect(result.primary).toBe("Você já finalizou 3 dias, conquistou 390 pontos e desbloqueou 3 marcos neste ciclo.");
  });

  it("uses singular forms correctly for exactly 1 of each", () => {
    const result = buildNarrativeSummary({
      achievementsUnlocked: 1,
      daysFinalized: 1,
      pointsTotal: 1,
      streakCurrent: 0,
      todayFinalized: true,
    });
    expect(result.primary).toBe("Você já finalizou 1 dia, conquistou 1 ponto e desbloqueou 1 marco neste ciclo.");
  });

  it("shows honest zeros instead of hiding the block - zero is real data, not a fabrication", () => {
    const result = buildNarrativeSummary({
      achievementsUnlocked: 0,
      daysFinalized: 0,
      pointsTotal: 0,
      streakCurrent: 0,
      todayFinalized: false,
    });
    expect(result.primary).toBe("Você já finalizou 0 dias, conquistou 0 pontos e desbloqueou 0 marcos neste ciclo.");
  });

  it("adds the streak-advance context sentence only when today is not finalized yet", () => {
    const result = buildNarrativeSummary({
      achievementsUnlocked: 2,
      daysFinalized: 2,
      pointsTotal: 200,
      streakCurrent: 1,
      todayFinalized: false,
    });
    expect(result.secondary).toBe("Hoje você pode avançar sua sequência para 2 dias.");
  });

  it("omits the second sentence once today is already finalized - the streak number is already final for today", () => {
    const result = buildNarrativeSummary({
      achievementsUnlocked: 2,
      daysFinalized: 3,
      pointsTotal: 300,
      streakCurrent: 3,
      todayFinalized: true,
    });
    expect(result.secondary).toBeNull();
  });
});
