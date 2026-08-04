import { describe, expect, it } from "vitest";

import {
  describeTimelineEvent,
  findClosestLockedAchievement,
  formatHabitTitlesSummary,
  getTimelineFilterTypes,
  groupTimelineEventsByDate,
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
    habit_titles: null,
    points: null,
    streak_value: null,
    ...overrides,
  };
}

describe("describeTimelineEvent - titulos narrativos em primeira pessoa (Refinamento premium, Parte D item 16)", () => {
  it("day_finalized: narrates day number and points together in the title, percent/habits stay in the description", () => {
    const result = describeTimelineEvent(
      baseEvent({ completion_percent: 80, day_number: 3, event_type: "day_finalized", points: 110 }),
    );
    expect(result.title).toBe("Você finalizou o Dia 3 e conquistou 110 pontos.");
    expect(result.description).toBe("80% concluído");
    expect(result.iconKey).toBe("day");
  });

  it("day_finalized: singular 'ponto' for exactly 1 point in the title, and a neutral description when nothing else is available", () => {
    const withOnePoint = describeTimelineEvent(baseEvent({ day_number: 1, event_type: "day_finalized", points: 1 }));
    expect(withOnePoint.title).toBe("Você finalizou o Dia 1 e conquistou 1 ponto.");

    const withNothing = describeTimelineEvent(
      baseEvent({ completion_percent: null, day_number: 1, event_type: "day_finalized", points: null }),
    );
    expect(withNothing.title).toBe("Você finalizou o Dia 1.");
    expect(withNothing.description).toBe("Dia registrado.");
  });

  it("day_finalized: never claims '0 pontos' as if it were a real reward - 0 reads the same as absent", () => {
    const result = describeTimelineEvent(baseEvent({ day_number: 2, event_type: "day_finalized", points: 0 }));
    expect(result.title).not.toContain("pontos");
    expect(result.title).toBe("Você finalizou o Dia 2.");
  });

  it("achievement_unlocked: names the real achievement in a first-person sentence, never a placeholder or system label", () => {
    const result = describeTimelineEvent(
      baseEvent({ achievement_name: "Retorno forte", event_type: "achievement_unlocked", points: 20 }),
    );
    expect(result.title).toBe("Você desbloqueou Retorno forte.");
    expect(result.description).toBe("20 pontos");
    expect(result.iconKey).toBe("achievement");
  });

  it("challenge_started/completed/abandoned: narrate the real challenge name in the title, never raw system language", () => {
    expect(describeTimelineEvent(baseEvent({ event_type: "challenge_started" })).title).toBe(
      "Você iniciou o Desafio de Agosto.",
    );
    expect(describeTimelineEvent(baseEvent({ event_type: "challenge_completed" })).title).toBe(
      "Você concluiu o Desafio de Agosto.",
    );
    expect(describeTimelineEvent(baseEvent({ event_type: "challenge_abandoned" })).title).toBe(
      "Você encerrou sua participação no Desafio de Agosto.",
    );
    expect(describeTimelineEvent(baseEvent({ challenge_name: "Desafio X", event_type: "challenge_started" })).title).toBe(
      "Você iniciou o Desafio X.",
    );
  });

  it("streak_record: fixed first-person title, description pluralizes correctly and never a bare number without context", () => {
    const plural = describeTimelineEvent(baseEvent({ event_type: "streak_record", streak_value: 5 }));
    expect(plural.title).toBe("Você bateu um novo recorde de sequência.");
    expect(plural.description).toContain("5 dias seguidos");

    const singular = describeTimelineEvent(baseEvent({ event_type: "streak_record", streak_value: 1 }));
    expect(singular.description).toMatch(/^1 dia seguidos/);
  });

  it("day_finalized: appends a truncated habit-titles summary to the description, alongside percent", () => {
    const result = describeTimelineEvent(
      baseEvent({
        completion_percent: 80,
        day_number: 3,
        event_type: "day_finalized",
        habit_titles: ["Treino", "Bíblia", "Oração", "Água", "Sono"],
        points: 110,
      }),
    );
    expect(result.description).toBe("80% concluído · Treino, Bíblia, Oração e mais 2 hábitos.");
  });

  it("halfway_reached: fixed first-person title, description carries the challenge name", () => {
    const result = describeTimelineEvent(
      baseEvent({ challenge_name: "Desafio de Agosto", event_type: "halfway_reached" }),
    );
    expect(result.title).toBe("Você chegou à metade do desafio.");
    expect(result.description).toBe("Desafio de Agosto");
    expect(result.iconKey).toBe("halfway");
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

  it("'Recordes' maps to streak_record and halfway_reached (both milestones) - never bleeding into achievements", () => {
    expect(getTimelineFilterTypes("records")).toEqual(["streak_record", "halfway_reached"]);
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

  it("carries description/icon/challengeName through for the dedicated 'Próxima conquista' block, defaulting to null when absent", () => {
    const withExtras = findClosestLockedAchievement([
      {
        challengeName: "Desafio de Agosto",
        description: "Leia por 7 dias.",
        icon: "book-open",
        name: "Sete leituras",
        progress: { current: 6, target: 7 },
      },
    ]);
    expect(withExtras).toEqual({
      challengeName: "Desafio de Agosto",
      current: 6,
      description: "Leia por 7 dias.",
      icon: "book-open",
      name: "Sete leituras",
      target: 7,
    });

    const withoutExtras = findClosestLockedAchievement([
      { name: "Sete leituras", progress: { current: 6, target: 7 } },
    ]);
    expect(withoutExtras).toEqual({
      challengeName: null,
      current: 6,
      description: null,
      icon: null,
      name: "Sete leituras",
      target: 7,
    });
  });
});

describe("formatHabitTitlesSummary", () => {
  it("returns null for empty/absent lists - never an empty string rendered as if it were real", () => {
    expect(formatHabitTitlesSummary(null)).toBeNull();
    expect(formatHabitTitlesSummary([])).toBeNull();
  });

  it("joins the full list when at or under the display limit", () => {
    expect(formatHabitTitlesSummary(["Treino", "Bíblia", "Oração"])).toBe("Treino, Bíblia, Oração");
  });

  it("truncates and counts the remainder, correct singular/plural", () => {
    expect(formatHabitTitlesSummary(["Treino", "Bíblia", "Oração", "Água", "Leitura"])).toBe(
      "Treino, Bíblia, Oração e mais 2 hábitos.",
    );
    expect(formatHabitTitlesSummary(["Treino", "Bíblia", "Oração", "Água"])).toBe(
      "Treino, Bíblia, Oração e mais 1 hábito.",
    );
  });
});

describe("groupTimelineEventsByDate", () => {
  const today = "2026-08-03";
  const yesterday = "2026-08-02";

  function eventAt(iso: string, overrides: Partial<TimelineEventRow> = {}): TimelineEventRow {
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
      event_at: iso,
      event_source_id: iso,
      event_type: "day_finalized",
      habit_titles: null,
      points: null,
      streak_value: null,
      ...overrides,
    };
  }

  it("groups same-day events under one 'Hoje' entry, in the original order", () => {
    const events = [
      eventAt("2026-08-03T20:54:38.382408+00:00", { event_type: "achievement_unlocked" }),
      eventAt("2026-08-03T20:54:38.382408+00:00", { event_type: "day_finalized" }),
    ];
    const groups = groupTimelineEventsByDate(events, today, yesterday);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.dateLabel).toBe("Hoje");
    expect(groups[0]?.events).toHaveLength(2);
  });

  it("labels yesterday's group 'Ontem', never repeating the raw date", () => {
    const groups = groupTimelineEventsByDate([eventAt("2026-08-02T10:00:00.000000+00:00")], today, yesterday);
    expect(groups[0]?.dateLabel).toBe("Ontem");
  });

  it("labels any other date as DD/MM", () => {
    const groups = groupTimelineEventsByDate([eventAt("2026-07-30T02:03:01.772465+00:00")], today, yesterday);
    expect(groups[0]?.dateLabel).toBe("30/07");
  });

  it("preserves chronological group order (already-sorted input, never re-sorted)", () => {
    const events = [
      eventAt("2026-08-03T20:54:38.382408+00:00"),
      eventAt("2026-08-02T10:00:00.000000+00:00"),
      eventAt("2026-07-30T02:03:01.772465+00:00"),
    ];
    const groups = groupTimelineEventsByDate(events, today, yesterday);
    expect(groups.map((group) => group.dateLabel)).toEqual(["Hoje", "Ontem", "30/07"]);
  });
});
