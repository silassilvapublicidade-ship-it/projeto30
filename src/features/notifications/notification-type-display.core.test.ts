import { describe, expect, it } from "vitest";

import { getNotificationTypeDisplay } from "./notification-type-display.core";

describe("getNotificationTypeDisplay", () => {
  it("maps every known automation/campaign type to a distinct, non-generic icon+category", () => {
    expect(getNotificationTypeDisplay("habit_reminder")).toEqual({ categoryLabel: "Hábito", icon: "habit" });
    expect(getNotificationTypeDisplay("daily_motivation")).toEqual({ categoryLabel: "Motivação", icon: "motivation" });
    expect(getNotificationTypeDisplay("achievement_unlocked")).toEqual({
      categoryLabel: "Conquista",
      icon: "achievement",
    });
    expect(getNotificationTypeDisplay("new_tip_published")).toEqual({ categoryLabel: "Dica", icon: "tip" });
    expect(getNotificationTypeDisplay("campaign")).toEqual({ categoryLabel: "Comunicado", icon: "campaign" });
  });

  it("falls back to a generic bell/aviso for an unmapped type, instead of throwing or returning undefined", () => {
    expect(getNotificationTypeDisplay("something_new_and_unmapped")).toEqual({
      categoryLabel: "Aviso",
      icon: "bell",
    });
  });

  it("every challenge-date automation shares the same 'Desafio' category", () => {
    for (const type of ["challenge_starting_tomorrow", "challenge_starting_today", "challenge_ending_soon"]) {
      expect(getNotificationTypeDisplay(type).categoryLabel).toBe("Desafio");
    }
  });
});
