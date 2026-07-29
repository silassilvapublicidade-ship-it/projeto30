import { describe, expect, it } from "vitest";

import {
  getAchievementProgress,
  getHalfwayTarget,
  getUnlockedAchievementSlugs,
  initialAchievementSlugs,
} from "./achievements.core";

describe("achievement rules", () => {
  it("keeps the halfway rule tied to the configured duration", () => {
    expect(getHalfwayTarget(21)).toBe(11);
    expect(getHalfwayTarget(45)).toBe(23);
  });

  it("unlocks the initial milestones without duplicates", () => {
    const result = getUnlockedAchievementSlugs(
      {
        completedCycle: false,
        completedHabitsLifetime: 1,
        durationDays: 30,
        finalizedDays: 7,
        physicalActivityCompletions: 7,
        readingCompletions: 7,
        reflectionDays: 7,
        returnStrong: true,
        streakCurrent: 3,
      },
      ["primeiro-dia"],
    );

    expect(result.unlockedSlugs).toEqual([
      "primeiro-habito",
      "tres-dias-seguidos",
      "primeira-semana",
      "sete-leituras",
      "sete-atividades-fisicas",
      "sete-reflexoes",
      "retorno-forte",
    ]);
  });

  it("contains the required initial achievement catalog", () => {
    expect(initialAchievementSlugs).toEqual([
      "primeiro-habito",
      "primeiro-dia",
      "tres-dias-seguidos",
      "primeira-semana",
      "sete-leituras",
      "sete-atividades-fisicas",
      "sete-reflexoes",
      "metade-do-caminho",
      "retorno-forte",
      "missao-concluida",
    ]);
  });
});

describe("getAchievementProgress", () => {
  const baseInput = {
    completedCycle: false,
    completedHabitsLifetime: 2,
    durationDays: 30,
    finalizedDays: 4,
    physicalActivityCompletions: 3,
    readingCompletions: 1,
    reflectionDays: 0,
    returnStrong: false,
    streakCurrent: 2,
  };

  it("returns a current/target pair for countable slugs, capped at the target", () => {
    expect(getAchievementProgress("primeira-semana", baseInput)).toEqual({
      current: 4,
      target: 7,
    });
    expect(
      getAchievementProgress("primeira-semana", { ...baseInput, finalizedDays: 20 }),
    ).toEqual({ current: 7, target: 7 });
  });

  it("computes the halfway target from durationDays", () => {
    expect(getAchievementProgress("metade-do-caminho", { ...baseInput, durationDays: 21 })).toEqual({
      current: 4,
      target: 11,
    });
  });

  it("returns null for a boolean-only criterion (no honest fraction to show)", () => {
    expect(getAchievementProgress("retorno-forte", baseInput)).toBeNull();
  });

  it("returns null for an unrecognized slug", () => {
    expect(getAchievementProgress("nao-existe" as never, baseInput)).toBeNull();
  });
});
