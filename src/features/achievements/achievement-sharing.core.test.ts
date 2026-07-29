import { describe, expect, it } from "vitest";

import { getAchievementShareText } from "./achievement-sharing.core";

describe("getAchievementShareText", () => {
  it("uses share_title/share_message verbatim when the achievement provides them", () => {
    expect(
      getAchievementShareText(
        {
          name: "Primeira semana",
          shareMessage: "Fechei minha primeira semana com constância.",
          shareTitle: "Uma semana inteira!",
        },
        "Ana",
      ),
    ).toEqual({
      message: "Fechei minha primeira semana com constância.",
      title: "Uma semana inteira!",
    });
  });

  it("falls back to a generic title/message built from name and challenge when unset", () => {
    const result = getAchievementShareText(
      { challengeName: "Desafio de Agosto", name: "Primeiro hábito" },
      "Ana",
    );

    expect(result.title).toBe("Conquista desbloqueada: Primeiro hábito");
    expect(result.message).toContain("Ana desbloqueou");
    expect(result.message).toContain("Primeiro hábito");
    expect(result.message).toContain("Desafio de Agosto");
  });

  it("never includes an email address, and works with no display name at all", () => {
    const result = getAchievementShareText({ name: "Primeiro hábito" }, undefined);

    expect(result.message).not.toContain("@");
    expect(result.message).toContain("Desbloqueei");
  });

  it("treats a blank display name the same as no display name", () => {
    const result = getAchievementShareText({ name: "Primeiro hábito" }, "   ");
    expect(result.message).toContain("Desbloqueei");
    expect(result.message).not.toContain("undefined");
  });
});
