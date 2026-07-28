import { describe, expect, it } from "vitest";

import {
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
