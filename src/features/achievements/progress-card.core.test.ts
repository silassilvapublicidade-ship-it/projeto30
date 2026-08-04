import { describe, expect, it } from "vitest";

import {
  buildProgressCardContent,
  buildProgressShareCardStoragePath,
  computeProgressSharePayloadHash,
  type ProgressCardSource,
} from "./progress-card.core";

const DAY_SOURCE: ProgressCardSource = {
  challengeName: "Desafio de Agosto",
  completionPercent: 80,
  dayNumber: 3,
  durationDays: 31,
  habitTitles: ["Treino", "Bíblia", "Oração"],
  kind: "day_completed",
  logDate: "2026-08-03",
  pointsEarned: 110,
  previousStreakBest: null,
  streakValue: 3,
};

const RECORD_SOURCE: ProgressCardSource = {
  challengeName: "Desafio de Agosto",
  completionPercent: null,
  dayNumber: null,
  durationDays: null,
  habitTitles: null,
  kind: "streak_record",
  logDate: "2026-08-03",
  pointsEarned: null,
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

describe("computeProgressSharePayloadHash", () => {
  it("is deterministic for the same input", () => {
    const content = buildProgressCardContent(DAY_SOURCE);
    const a = computeProgressSharePayloadHash({
      content,
      dailyLogId: "log-1",
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    const b = computeProgressSharePayloadHash({
      content,
      dailyLogId: "log-1",
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    expect(a).toBe(b);
  });

  it("changes when the underlying content changes", () => {
    const contentA = buildProgressCardContent(DAY_SOURCE);
    const contentB = buildProgressCardContent({ ...DAY_SOURCE, pointsEarned: 200 });
    const hashA = computeProgressSharePayloadHash({
      content: contentA,
      dailyLogId: "log-1",
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    const hashB = computeProgressSharePayloadHash({
      content: contentB,
      dailyLogId: "log-1",
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    expect(hashA).not.toBe(hashB);
  });

  it("changes when template_version changes - invalidates cards on a template redesign", () => {
    const content = buildProgressCardContent(DAY_SOURCE);
    const v1 = computeProgressSharePayloadHash({
      content,
      dailyLogId: "log-1",
      templateSlug: "progress_day_story",
      templateVersion: 1,
    });
    const v2 = computeProgressSharePayloadHash({
      content,
      dailyLogId: "log-1",
      templateSlug: "progress_day_story",
      templateVersion: 2,
    });
    expect(v1).not.toBe(v2);
  });
});

describe("buildProgressShareCardStoragePath", () => {
  it("scopes the path by user then daily log then kind+format - never collides across users", () => {
    expect(buildProgressShareCardStoragePath("user-1", "log-1", "day_completed", "story")).toBe(
      "progress/user-1/log-1/day_completed-story.png",
    );
    expect(buildProgressShareCardStoragePath("user-1", "log-1", "streak_record", "feed")).toBe(
      "progress/user-1/log-1/streak_record-feed.png",
    );
  });
});
