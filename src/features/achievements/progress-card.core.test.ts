import { describe, expect, it } from "vitest";

import {
  buildProgressCardContent,
  buildProgressShareCardStoragePath,
  computeProgressSharePayloadHash,
  type ProgressCardSource,
} from "./progress-card.core";

const BASE_SOURCE: ProgressCardSource = {
  achievementsUnlocked: null,
  challengeName: "Desafio de Agosto",
  completionPercent: null,
  dayNumber: null,
  daysFinalized: null,
  daysRemaining: null,
  durationDays: null,
  finalMessage: null,
  habitTitles: null,
  kind: "day_completed",
  logDate: "2026-08-03",
  pointsEarned: null,
  pointsTotal: null,
  previousStreakBest: null,
  streakBest: null,
  streakValue: null,
  weekAverageCompletion: null,
  weekBestStreak: null,
  weekDaysFinalized: null,
  weekHabitsCompleted: null,
  weekPoints: null,
};

const DAY_SOURCE: ProgressCardSource = {
  ...BASE_SOURCE,
  completionPercent: 80,
  dayNumber: 3,
  durationDays: 31,
  habitTitles: ["Treino", "Bíblia", "Oração"],
  kind: "day_completed",
  pointsEarned: 110,
  streakValue: 3,
};

const RECORD_SOURCE: ProgressCardSource = {
  ...BASE_SOURCE,
  kind: "streak_record",
  previousStreakBest: 5,
  streakValue: 8,
};

describe("buildProgressCardContent - dia concluído", () => {
  it("uses real data only: day number, percent, points, streak, real habit names", () => {
    const content = buildProgressCardContent(DAY_SOURCE);
    expect(content.title).toBe("Dia 3 concluído");
    expect(content.subtitle).toBe("Treino, Bíblia, Oração");
    expect(content.microDetails).toEqual(["80% concluído", "110 pontos", "Sequência: 3 dias"]);
    expect(content.icon).toBe("sunrise");
    expect(content.sceneId).toBe("sunrise-glow");
  });

  it("truncates the habit list and counts the remainder", () => {
    const content = buildProgressCardContent({
      ...DAY_SOURCE,
      habitTitles: ["Treino", "Bíblia", "Oração", "Água", "Sono", "Leitura"],
    });
    expect(content.subtitle).toBe("Treino, Bíblia, Oração, Água e mais 2 hábitos");
  });

  it("never fabricates points/percent when absent - omitted, not zeroed", () => {
    const content = buildProgressCardContent({
      ...DAY_SOURCE,
      completionPercent: null,
      pointsEarned: null,
      streakValue: null,
    });
    expect(content.microDetails).toEqual([]);
  });

  it("never includes an email or display name", () => {
    const content = buildProgressCardContent(DAY_SOURCE);
    expect(JSON.stringify(content)).not.toMatch(/@|display_name/i);
  });
});

describe("buildProgressCardContent - novo recorde", () => {
  it("names the real streak value and the previous record when available", () => {
    const content = buildProgressCardContent(RECORD_SOURCE);
    expect(content.title).toBe("Novo recorde de sequência");
    expect(content.subtitle).toBe("8 dias seguidos - o maior desde que você começou.");
    expect(content.microDetails).toEqual(["Recorde anterior: 5 dias"]);
    expect(content.icon).toBe("flame");
    expect(content.sceneId).toBe("ember-rise");
  });

  it("omits the previous-record line when it isn't available - never fabricates one", () => {
    const content = buildProgressCardContent({ ...RECORD_SOURCE, previousStreakBest: null });
    expect(content.microDetails).toEqual([]);
  });

  it("singular for exactly 1 day", () => {
    const content = buildProgressCardContent({ ...RECORD_SOURCE, streakValue: 1 });
    expect(content.subtitle).toContain("1 dia seguidos");
  });
});

describe("buildProgressCardContent - sequência em alta (streak_reached)", () => {
  it("titles the real streak length, distinct copy from the 'novo recorde' card", () => {
    const content = buildProgressCardContent({ ...BASE_SOURCE, kind: "streak_reached", pointsEarned: 40, streakValue: 7 });
    expect(content.title).toBe("7 dias seguidos");
    expect(content.icon).toBe("zap");
    expect(content.sceneId).toBe("ascending-lines");
    expect(content.microDetails).toEqual(["40 pontos"]);
  });

  it("singular for exactly 1 day (defensive - service layer never allows below 3)", () => {
    const content = buildProgressCardContent({ ...BASE_SOURCE, kind: "streak_reached", streakValue: 1 });
    expect(content.title).toBe("1 dia seguidos");
  });
});

describe("buildProgressCardContent - metade do desafio (halfway)", () => {
  it("shows the real halfway day and account-real totals, never fabricated", () => {
    const content = buildProgressCardContent({
      ...BASE_SOURCE,
      daysFinalized: 16,
      durationDays: 31,
      kind: "halfway",
      pointsTotal: 900,
      streakBest: 6,
    });
    expect(content.title).toBe("Você chegou à metade do desafio");
    expect(content.subtitle).toBe("Dia 16 de 31");
    expect(content.microDetails).toEqual(["900 pontos", "16 dias finalizados", "Sequência: 6 dias"]);
    expect(content.icon).toBe("route");
    expect(content.sceneId).toBe("progress-marker");
  });
});

describe("buildProgressCardContent - últimos 7 dias (last_7_days)", () => {
  it("counts down the real days remaining", () => {
    const content = buildProgressCardContent({ ...BASE_SOURCE, completionPercent: 70, daysRemaining: 4, kind: "last_7_days" });
    expect(content.title).toBe("Faltam 4 dias");
    expect(content.microDetails).toEqual(["70% concluído"]);
    expect(content.icon).toBe("calendar-check");
    expect(content.sceneId).toBe("speed-lines");
  });

  it("uses singular 'Último dia' copy for the final day, never 'Faltam 1 dias'", () => {
    const content = buildProgressCardContent({ ...BASE_SOURCE, daysRemaining: 1, kind: "last_7_days" });
    expect(content.title).toBe("Último dia");
  });
});

describe("buildProgressCardContent - resumo semanal (weekly_summary)", () => {
  it("shows the real weekly aggregate - days finalized, average completion, points, best streak", () => {
    const content = buildProgressCardContent({
      ...BASE_SOURCE,
      kind: "weekly_summary",
      weekAverageCompletion: 82.5,
      weekBestStreak: 5,
      weekDaysFinalized: 6,
      weekPoints: 480,
    });
    expect(content.subtitle).toBe("6 de 7 dias finalizados nesta semana.");
    expect(content.microDetails).toEqual(["480 pontos", "Média de 83% concluído", "Melhor sequência: 5 dias"]);
    expect(content.icon).toBe("star");
    expect(content.sceneId).toBe("sequence-marks");
  });
});

describe("buildProgressCardContent - progresso do desafio (challenge_progress)", () => {
  it("titles the real completion percent and lists the real totals", () => {
    const content = buildProgressCardContent({
      ...BASE_SOURCE,
      achievementsUnlocked: 4,
      completionPercent: 61.3,
      daysFinalized: 19,
      durationDays: 31,
      kind: "challenge_progress",
      pointsTotal: 1100,
      streakBest: 9,
    });
    expect(content.title).toBe("61% do caminho percorrido");
    expect(content.subtitle).toBe("19 de 31 dias concluídos");
    expect(content.microDetails).toEqual(["1100 pontos", "4 conquistas", "Recorde: 9 dias"]);
    expect(content.icon).toBe("gem");
    expect(content.sceneId).toBe("loop-arc");
  });
});

describe("buildProgressCardContent - desafio concluído (challenge_completed)", () => {
  it("uses the real final message, never a generic placeholder", () => {
    const content = buildProgressCardContent({
      ...BASE_SOURCE,
      achievementsUnlocked: 8,
      daysFinalized: 31,
      finalMessage: "Você concluiu Desafio de Agosto - 31 dias finalizados.",
      kind: "challenge_completed",
      pointsTotal: 2400,
      streakBest: 12,
    });
    expect(content.title).toBe("Desafio concluído");
    expect(content.subtitle).toBe("Você concluiu Desafio de Agosto - 31 dias finalizados.");
    expect(content.microDetails).toEqual(["2400 pontos", "31 dias finalizados", "Melhor sequência: 12 dias", "8 conquistas"]);
    expect(content.icon).toBe("trophy");
    expect(content.sceneId).toBe("grid-bloom");
  });
});

describe("computeProgressSharePayloadHash", () => {
  it("is deterministic for the same input", () => {
    const content = buildProgressCardContent(DAY_SOURCE);
    const a = computeProgressSharePayloadHash({
      anchorId: "log-1",
      content,
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    const b = computeProgressSharePayloadHash({
      anchorId: "log-1",
      content,
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    expect(a).toBe(b);
  });

  it("changes when the underlying content changes", () => {
    const contentA = buildProgressCardContent(DAY_SOURCE);
    const contentB = buildProgressCardContent({ ...DAY_SOURCE, pointsEarned: 200 });
    const hashA = computeProgressSharePayloadHash({
      anchorId: "log-1",
      content: contentA,
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    const hashB = computeProgressSharePayloadHash({
      anchorId: "log-1",
      content: contentB,
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    expect(hashA).not.toBe(hashB);
  });

  it("changes when template_version changes - invalidates cards on a template redesign", () => {
    const content = buildProgressCardContent(DAY_SOURCE);
    const v1 = computeProgressSharePayloadHash({
      anchorId: "log-1",
      content,
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    const v2 = computeProgressSharePayloadHash({
      anchorId: "log-1",
      content,
      templateSlug: "progress_day_story",
      templateVersion: 2,
    });
    expect(v1).not.toBe(v2);
  });

  it("changes when the anchor id changes - an enrollment snapshot never collides with another enrollment's cache", () => {
    const content = buildProgressCardContent({ ...BASE_SOURCE, kind: "halfway" });
    const a = computeProgressSharePayloadHash({
      anchorId: "enrollment-1",
      content,
      templateSlug: "halfway_story",
      templateVersion: 1,
    });
    const b = computeProgressSharePayloadHash({
      anchorId: "enrollment-2",
      content,
      templateSlug: "halfway_story",
      templateVersion: 1,
    });
    expect(a).not.toBe(b);
  });
});

describe("buildProgressShareCardStoragePath", () => {
  it("scopes the path by user then anchor then kind+format - never collides across users", () => {
    expect(buildProgressShareCardStoragePath("user-1", "log-1", "day_completed", "story")).toBe(
      "progress/user-1/log-1/day_completed-story.png",
    );
    expect(buildProgressShareCardStoragePath("user-1", "log-1", "streak_record", "feed")).toBe(
      "progress/user-1/log-1/streak_record-feed.png",
    );
  });

  it("works identically for an enrollment-anchored snapshot kind", () => {
    expect(buildProgressShareCardStoragePath("user-1", "enrollment-1", "halfway", "story")).toBe(
      "progress/user-1/enrollment-1/halfway-story.png",
    );
  });
});
