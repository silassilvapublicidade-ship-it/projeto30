import { describe, expect, it } from "vitest";

import { getSceneForAchievement, SCENE_IDS } from "./achievement-scene.core";

const CANONICAL_SLUGS = [
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
];

describe("getSceneForAchievement", () => {
  it("maps every one of the 10 canonical achievements to a real, distinct scene", () => {
    const scenes = CANONICAL_SLUGS.map((slug) => getSceneForAchievement(slug));
    for (const scene of scenes) {
      expect(SCENE_IDS).toContain(scene);
    }
    expect(new Set(scenes).size).toBe(CANONICAL_SLUGS.length);
  });

  it("falls back to the generic soft-light scene for an unknown slug - never throws", () => {
    expect(getSceneForAchievement("uma-conquista-nova-qualquer")).toBe("soft-light");
  });

  it("falls back to soft-light for null/undefined (e.g. an admin preview draft with no slug yet)", () => {
    expect(getSceneForAchievement(null)).toBe("soft-light");
    expect(getSceneForAchievement(undefined)).toBe("soft-light");
  });
});
