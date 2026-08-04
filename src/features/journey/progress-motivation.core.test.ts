import { describe, expect, it } from "vitest";

import {
  describeDayOverDayComparison,
  resolveDailyChallengeMessage,
  resolveProgressMotivationalMessage,
} from "./progress-motivation.core";

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

describe("describeDayOverDayComparison - auditoria de produto, item 03 ('hoje você fez mais que ontem')", () => {
  it("never fabricates a comparison when there's nothing real to compare against (no finalized log yesterday)", () => {
    expect(describeDayOverDayComparison({ todayPercent: 80, yesterdayPercent: null })).toBeNull();
  });

  it("says today is ahead when it genuinely is", () => {
    expect(describeDayOverDayComparison({ todayPercent: 60, yesterdayPercent: 40 })).toBe(
      "Hoje você já fez mais que ontem.",
    );
  });

  it("says the same pace when tied, rather than staying silent", () => {
    expect(describeDayOverDayComparison({ todayPercent: 50, yesterdayPercent: 50 })).toBe(
      "Hoje você está no mesmo ritmo de ontem.",
    );
  });

  it("never shows a discouraging message when today is currently behind yesterday - invites the user to keep going instead (Dashboard como alma do app, Parte B item 9)", () => {
    expect(describeDayOverDayComparison({ todayPercent: 20, yesterdayPercent: 80 })).toBe(
      "Você ainda pode avançar hoje.",
    );
  });

  it("never uses the words 'pior' or 'menos' in any branch - the comparison never reads as a penalty", () => {
    const behind = describeDayOverDayComparison({ todayPercent: 0, yesterdayPercent: 100 });
    expect(behind).not.toMatch(/pior|menos/i);
  });

  it("handles the zero/zero edge case as a tie, not a fabricated comparison", () => {
    expect(describeDayOverDayComparison({ todayPercent: 0, yesterdayPercent: 0 })).toBe(
      "Hoje você está no mesmo ritmo de ontem.",
    );
  });
});
