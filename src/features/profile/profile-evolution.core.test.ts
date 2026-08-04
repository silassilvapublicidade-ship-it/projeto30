import { describe, expect, it } from "vitest";

import {
  describeEvolutionHighlight,
  describeNextObjective,
  describeTimelineEvent,
  findClosestLockedAchievement,
  getTimelineFilterTypes,
  TIMELINE_FILTERS,
  type TimelineEventRow,
} from "./profile-evolution.core";

function baseEvent(overrides: Partial<TimelineEventRow>): TimelineEventRow {
  return {
    achievement_icon: null,
    achievement_name: null,
    achievement_rarity: null,
    achievement_slug: null,
    challenge_id: "challenge-1",
    challenge_name: "Desafio de Agosto",
    completion_percent: null,
    day_number: null,
    enrollment_id: "enrollment-1",
    event_at: "2026-08-03T20:54:38.382408+00:00",
    event_source_id: "source-1",
    event_type: "day_finalized",
    points: null,
    streak_value: null,
    ...overrides,
  };
}

describe("describeTimelineEvent", () => {
  it("day_finalized: shows day number, points and percent when all present", () => {
    const result = describeTimelineEvent(
      baseEvent({ completion_percent: 80, day_number: 3, event_type: "day_finalized", points: 110 }),
    );
    expect(result.title).toBe("Dia 3 finalizado");
    expect(result.description).toBe("110 pontos · 80% concluído");
    expect(result.iconKey).toBe("day");
  });

  it("day_finalized: singular 'ponto' for exactly 1 point, and falls back to a neutral description when both points and percent are absent", () => {
    const withOnePoint = describeTimelineEvent(baseEvent({ day_number: 1, event_type: "day_finalized", points: 1 }));
    expect(withOnePoint.description).toBe("1 ponto");

    const withNothing = describeTimelineEvent(
      baseEvent({ completion_percent: null, day_number: 1, event_type: "day_finalized", points: null }),
    );
    expect(withNothing.description).toBe("Dia registrado.");
  });

  it("day_finalized: never shows '0 pontos' as if it were a real number - 0 reads the same as absent", () => {
    const result = describeTimelineEvent(baseEvent({ day_number: 2, event_type: "day_finalized", points: 0 }));
    expect(result.description).not.toContain("0 pontos");
  });

  it("achievement_unlocked: uses the real achievement name, never a placeholder", () => {
    const result = describeTimelineEvent(
      baseEvent({ achievement_name: "Retorno forte", event_type: "achievement_unlocked", points: 20 }),
    );
    expect(result.title).toBe("Conquista desbloqueada: Retorno forte");
    expect(result.description).toBe("20 pontos");
    expect(result.iconKey).toBe("achievement");
  });

  it("challenge_started/completed/abandoned: title is fixed, description carries the real challenge name", () => {
    expect(describeTimelineEvent(baseEvent({ event_type: "challenge_started" })).title).toBe("Desafio iniciado");
    expect(describeTimelineEvent(baseEvent({ event_type: "challenge_completed" })).title).toBe("Desafio concluído");
    expect(describeTimelineEvent(baseEvent({ event_type: "challenge_abandoned" })).title).toBe("Desafio abandonado");
    expect(describeTimelineEvent(baseEvent({ challenge_name: "Desafio X", event_type: "challenge_started" })).description).toBe(
      "Desafio X",
    );
  });

  it("streak_record: pluralizes correctly and never a bare number without context", () => {
    const plural = describeTimelineEvent(baseEvent({ event_type: "streak_record", streak_value: 5 }));
    expect(plural.description).toContain("5 dias seguidos");

    const singular = describeTimelineEvent(baseEvent({ event_type: "streak_record", streak_value: 1 }));
    expect(singular.description).toMatch(/^1 dia seguidos/);
  });
});

describe("TIMELINE_FILTERS / getTimelineFilterTypes", () => {
  it("has exactly the 5 filters from the brief, 'Tudo' first with a null type filter (no restriction)", () => {
    expect(TIMELINE_FILTERS.map((f) => f.label)).toEqual(["Tudo", "Dias", "Conquistas", "Desafios", "Recordes"]);
    expect(getTimelineFilterTypes("all")).toBeNull();
  });

  it("'Desafios' groups all 3 challenge lifecycle event types together", () => {
    expect(getTimelineFilterTypes("challenges")).toEqual([
      "challenge_started",
      "challenge_completed",
      "challenge_abandoned",
    ]);
  });

  it("'Recordes' maps only to streak_record, never bleeding into achievements", () => {
    expect(getTimelineFilterTypes("records")).toEqual(["streak_record"]);
  });
});

describe("describeEvolutionHighlight", () => {
  const base = {
    currentDay: 10,
    daysFinalized: 5,
    daysRemainingInChallenge: 21,
    dayOverDayMessage: null,
    durationDays: 31,
    streakBest: 3,
    streakCurrent: 1,
  };

  it("prioritizes 'bateu recorde' when currently AT the record (current === best, both > 0)", () => {
    expect(describeEvolutionHighlight({ ...base, streakBest: 3, streakCurrent: 3 })).toBe(
      "Você bateu sua melhor sequência.",
    );
  });

  it("never claims a record when streakCurrent is 0, even if streakBest is also 0 (would be a false positive)", () => {
    const result = describeEvolutionHighlight({ ...base, streakBest: 0, streakCurrent: 0, daysFinalized: 0 });
    expect(result).not.toBe("Você bateu sua melhor sequência.");
  });

  it("surfaces the real day-over-day comparison when provided, ahead of generic messages", () => {
    expect(
      describeEvolutionHighlight({ ...base, streakBest: 3, streakCurrent: 1, dayOverDayMessage: "Hoje você já fez mais que ontem." }),
    ).toBe("Hoje você já fez mais que ontem.");
  });

  it("announces the challenge is almost done when 5 or fewer days remain", () => {
    expect(describeEvolutionHighlight({ ...base, daysRemainingInChallenge: 5 })).toBe(
      "Faltam 5 dias para concluir este desafio.",
    );
    expect(describeEvolutionHighlight({ ...base, daysRemainingInChallenge: 1 })).toBe(
      "Faltam 1 dia para concluir este desafio.",
    );
  });

  it("announces the halfway mark only on the exact halfway day, not every day past it", () => {
    expect(
      describeEvolutionHighlight({ ...base, currentDay: 16, daysRemainingInChallenge: 15, durationDays: 31 }),
    ).toBe("Você está na metade do caminho.");
    expect(
      describeEvolutionHighlight({ ...base, currentDay: 17, daysRemainingInChallenge: 14, durationDays: 31 }),
    ).not.toBe("Você está na metade do caminho.");
  });

  it("falls back to streakBest, then daysFinalized, then a generic honest message - in that order, never fabricating", () => {
    expect(describeEvolutionHighlight({ ...base, daysRemainingInChallenge: null, currentDay: null, durationDays: null })).toBe(
      "Seu recorde atual é de 3 dias.",
    );
    expect(
      describeEvolutionHighlight({
        ...base,
        daysFinalized: 7,
        daysRemainingInChallenge: null,
        currentDay: null,
        durationDays: null,
        streakBest: 0,
      }),
    ).toBe("Você já concluiu 7 dias.");
    expect(
      describeEvolutionHighlight({
        currentDay: null,
        daysFinalized: 0,
        daysRemainingInChallenge: null,
        dayOverDayMessage: null,
        durationDays: null,
        streakBest: 0,
        streakCurrent: 0,
      }),
    ).toBe("Sua jornada está prestes a começar.");
  });
});

describe("describeNextObjective", () => {
  it("prioritizes the objective with the smallest gap among all computable ones", () => {
    const result = describeNextObjective({
      closestLockedAchievement: { current: 5, name: "Sete leituras", target: 7 },
      currentDay: 10,
      durationDays: 31,
      streakBest: 5,
      streakCurrent: 4,
    });
    // streak gap = 1, halfway gap = 16-10=6, achievement gap = 2 -> streak wins
    expect(result).toBe("Complete mais 1 dia para igualar seu recorde de 5 dias.");
  });

  it("suggests tying the record with correct singular/plural", () => {
    expect(
      describeNextObjective({
        closestLockedAchievement: null,
        currentDay: null,
        durationDays: null,
        streakBest: 5,
        streakCurrent: 4,
      }),
    ).toBe("Complete mais 1 dia para igualar seu recorde de 5 dias.");
  });

  it("never suggests tying a record the user is already at or ahead of", () => {
    const result = describeNextObjective({
      closestLockedAchievement: null,
      currentDay: null,
      durationDays: null,
      streakBest: 5,
      streakCurrent: 5,
    });
    expect(result).not.toContain("igualar seu recorde");
  });

  it("suggests the halfway mark when that's the closest computable objective", () => {
    const result = describeNextObjective({
      closestLockedAchievement: null,
      currentDay: 14,
      durationDays: 31,
      streakBest: 0,
      streakCurrent: 0,
    });
    expect(result).toBe("Faltam 2 dias para a metade do desafio.");
  });

  it("suggests the closest locked achievement by real progress, naming it exactly", () => {
    const result = describeNextObjective({
      closestLockedAchievement: { current: 6, name: "Sete leituras", target: 7 },
      currentDay: null,
      durationDays: null,
      streakBest: 0,
      streakCurrent: 0,
    });
    expect(result).toBe('Faltam 1 passo para desbloquear "Sete leituras".');
  });

  it("falls back to the exact honest copy from the brief when nothing is computable", () => {
    const result = describeNextObjective({
      closestLockedAchievement: null,
      currentDay: null,
      durationDays: null,
      streakBest: 0,
      streakCurrent: 0,
    });
    expect(result).toBe("Continue registrando sua jornada. Cada dia conta.");
  });

  it("never reveals a locked achievement whose progress is already at 100% (should have unlocked already, not a real 'next' objective)", () => {
    const result = describeNextObjective({
      closestLockedAchievement: { current: 7, name: "Sete leituras", target: 7 },
      currentDay: null,
      durationDays: null,
      streakBest: 0,
      streakCurrent: 0,
    });
    expect(result).toBe("Continue registrando sua jornada. Cada dia conta.");
  });
});

describe("findClosestLockedAchievement", () => {
  it("picks the achievement with the smallest remaining gap, not the highest raw progress", () => {
    const result = findClosestLockedAchievement([
      { name: "Primeira semana", progress: { current: 1, target: 7 } },
      { name: "Sete leituras", progress: { current: 6, target: 7 } },
      { name: "Metade do caminho", progress: { current: 3, target: 16 } },
    ]);
    expect(result?.name).toBe("Sete leituras");
  });

  it("skips achievements with a boolean (null) criterion - never a fake progress bar for them", () => {
    const result = findClosestLockedAchievement([
      { name: "Retorno forte", progress: null },
      { name: "Sete leituras", progress: { current: 6, target: 7 } },
    ]);
    expect(result?.name).toBe("Sete leituras");
  });

  it("returns null when every locked achievement is boolean-only or the list is empty", () => {
    expect(findClosestLockedAchievement([{ name: "Retorno forte", progress: null }])).toBeNull();
    expect(findClosestLockedAchievement([])).toBeNull();
  });
});
