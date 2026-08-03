import { describe, expect, it } from "vitest";

import { resolveDailyChallengeMessage, resolveProgressMotivationalMessage } from "./progress-motivation.core";

describe("resolveProgressMotivationalMessage", () => {
  it("matches every boundary from the brief's own table", () => {
    expect(resolveProgressMotivationalMessage(0)).toBe("Todo progresso começa com uma escolha.");
    expect(resolveProgressMotivationalMessage(1)).toBe("Você começou. Continue avançando.");
    expect(resolveProgressMotivationalMessage(25)).toBe("Você começou. Continue avançando.");
    expect(resolveProgressMotivationalMessage(26)).toBe("Cada ação conta.");
    expect(resolveProgressMotivationalMessage(49)).toBe("Cada ação conta.");
    expect(resolveProgressMotivationalMessage(50)).toBe("Você já fez muito hoje.");
    expect(resolveProgressMotivationalMessage(69)).toBe("Você já fez muito hoje.");
    expect(resolveProgressMotivationalMessage(70)).toBe("Um dia consistente está sendo construído.");
    expect(resolveProgressMotivationalMessage(89)).toBe("Um dia consistente está sendo construído.");
    expect(resolveProgressMotivationalMessage(90)).toBe("Você está muito perto de completar o dia.");
    expect(resolveProgressMotivationalMessage(99)).toBe("Você está muito perto de completar o dia.");
    expect(resolveProgressMotivationalMessage(100)).toBe("Dia completo. Excelente trabalho.");
  });

  it("never returns an empty string for any percent in range", () => {
    for (let percent = 0; percent <= 100; percent += 1) {
      expect(resolveProgressMotivationalMessage(percent).length).toBeGreaterThan(0);
    }
  });
});

describe("resolveDailyChallengeMessage", () => {
  it("returns the challenge_days.message verbatim when present", () => {
    expect(resolveDailyChallengeMessage("O mais difícil era começar. Você começou.")).toBe(
      "O mais difícil era começar. Você começou.",
    );
  });

  it("falls back to the brief's exact fallback copy when null/empty/whitespace", () => {
    const fallback = "Você foi um pouco melhor hoje. Amanhã, continue.";
    expect(resolveDailyChallengeMessage(null)).toBe(fallback);
    expect(resolveDailyChallengeMessage(undefined)).toBe(fallback);
    expect(resolveDailyChallengeMessage("")).toBe(fallback);
    expect(resolveDailyChallengeMessage("   ")).toBe(fallback);
  });
});
