import { describe, expect, it } from "vitest";

import {
  describeChallengeDisplayStatus,
  describeHabitFrequency,
  describeHabitGoal,
  getChallengeCta,
  getChallengeDisplayStatus,
  parseChallengeThemeConfig,
  parseHabitGoalConfig,
} from "./challenge-catalog.core";

describe("getChallengeDisplayStatus", () => {
  it("returns joined for an active or paused enrollment, regardless of challenge status", () => {
    expect(
      getChallengeDisplayStatus({
        challengeStatus: "active",
        enrollmentStart: null,
        enrollmentStatus: "active",
        localDate: "2026-08-01",
      }),
    ).toBe("joined");

    expect(
      getChallengeDisplayStatus({
        challengeStatus: "ended",
        enrollmentStart: null,
        enrollmentStatus: "paused",
        localDate: "2026-08-01",
      }),
    ).toBe("joined");
  });

  it("returns completed for a completed enrollment", () => {
    expect(
      getChallengeDisplayStatus({
        challengeStatus: "active",
        enrollmentStart: null,
        enrollmentStatus: "completed",
        localDate: "2026-08-01",
      }),
    ).toBe("completed");
  });

  it("returns abandoned for abandoned or restarted enrollments", () => {
    expect(
      getChallengeDisplayStatus({
        challengeStatus: "active",
        enrollmentStart: null,
        enrollmentStatus: "abandoned",
        localDate: "2026-08-01",
      }),
    ).toBe("abandoned");

    expect(
      getChallengeDisplayStatus({
        challengeStatus: "active",
        enrollmentStart: null,
        enrollmentStatus: "restarted",
        localDate: "2026-08-01",
      }),
    ).toBe("abandoned");
  });

  it("returns ended for an ended challenge with no enrollment", () => {
    expect(
      getChallengeDisplayStatus({
        challengeStatus: "ended",
        enrollmentStart: null,
        enrollmentStatus: null,
        localDate: "2026-08-01",
      }),
    ).toBe("ended");
  });

  it("returns unavailable for draft, paused or archived challenges with no enrollment", () => {
    for (const status of ["draft", "paused", "archived"] as const) {
      expect(
        getChallengeDisplayStatus({
          challengeStatus: status,
          enrollmentStart: null,
          enrollmentStatus: null,
          localDate: "2026-08-01",
        }),
      ).toBe("unavailable");
    }
  });

  it("returns coming_soon when the challenge is active but enrollment has not opened yet", () => {
    expect(
      getChallengeDisplayStatus({
        challengeStatus: "active",
        enrollmentStart: "2026-09-01",
        enrollmentStatus: null,
        localDate: "2026-08-01",
      }),
    ).toBe("coming_soon");
  });

  it("returns available when active, enrollment open, and no enrollment yet", () => {
    expect(
      getChallengeDisplayStatus({
        challengeStatus: "active",
        enrollmentStart: "2026-07-01",
        enrollmentStatus: null,
        localDate: "2026-08-01",
      }),
    ).toBe("available");

    expect(
      getChallengeDisplayStatus({
        challengeStatus: "active",
        enrollmentStart: null,
        enrollmentStatus: null,
        localDate: "2026-08-01",
      }),
    ).toBe("available");
  });
});

describe("getChallengeCta", () => {
  it("offers to continue when already joined", () => {
    expect(getChallengeCta("joined")).toEqual({
      disabled: false,
      kind: "continue",
      label: "Continuar desafio",
    });
  });

  it("allows joining an available challenge - simultaneous enrollments elsewhere never block it", () => {
    expect(getChallengeCta("available")).toEqual({
      disabled: false,
      kind: "join",
      label: "Participar",
    });
  });

  it("never offers to join non-available, non-joined statuses", () => {
    const nonJoinable = ["completed", "abandoned", "coming_soon", "ended", "unavailable"] as const;

    for (const status of nonJoinable) {
      const cta = getChallengeCta(status);
      expect(cta.kind).not.toBe("join");
    }
  });

  it("marks a completed challenge as informational and disabled", () => {
    expect(getChallengeCta("completed")).toEqual({
      disabled: true,
      kind: "info",
      label: "Desafio concluído",
    });
  });

  it("has no 'blocked' kind anymore - cross-challenge blocking was removed", () => {
    const statuses = [
      "abandoned",
      "available",
      "coming_soon",
      "completed",
      "ended",
      "joined",
      "unavailable",
    ] as const;

    for (const status of statuses) {
      expect(getChallengeCta(status).kind).not.toBe("blocked");
    }
  });
});

describe("parseChallengeThemeConfig", () => {
  it("reads only the known string keys, ignoring unrelated/legacy keys", () => {
    expect(
      parseChallengeThemeConfig({
        campaign: "agosto_2026",
        cta_label: "Vem comigo!",
        headline: "Desafio para se tornar irreconhecível em agosto",
        subheadline: "Pequenas escolhas diárias, grandes resultados para sempre.",
      }),
    ).toEqual({
      cta_label: "Vem comigo!",
      headline: "Desafio para se tornar irreconhecível em agosto",
      subheadline: "Pequenas escolhas diárias, grandes resultados para sempre.",
    });
  });

  it("reads cover_image_url, tagline, hero_message and cta_supporting_text", () => {
    expect(
      parseChallengeThemeConfig({
        cover_image_url: "https://example.supabase.co/storage/v1/object/public/challenge-covers/x.webp",
        cta_supporting_text: "O melhor mês do ano começa agora.",
        hero_message: "O melhor mês do ano começa agora.",
        tagline: "Disciplina hoje, liberdade amanhã!",
      }),
    ).toEqual({
      cover_image_url: "https://example.supabase.co/storage/v1/object/public/challenge-covers/x.webp",
      cta_supporting_text: "O melhor mês do ano começa agora.",
      hero_message: "O melhor mês do ano começa agora.",
      tagline: "Disciplina hoje, liberdade amanhã!",
    });
  });

  it("returns an empty object for null, non-object or empty-string values", () => {
    expect(parseChallengeThemeConfig(null)).toEqual({});
    expect(parseChallengeThemeConfig("not-json")).toEqual({});
    expect(parseChallengeThemeConfig({ headline: "" })).toEqual({});
  });
});

describe("parseHabitGoalConfig", () => {
  it("reads target/unit/short_title/label when present", () => {
    expect(
      parseHabitGoalConfig({ label: "Confirmar sessão", short_title: "Musculação", target: 4, unit: "Sessões" }),
    ).toEqual({
      label: "Confirmar sessão",
      short_title: "Musculação",
      target: 4,
      unit: "Sessões",
    });
  });

  it("ignores a non-numeric target", () => {
    expect(parseHabitGoalConfig({ target: "muitas", unit: "Litros" })).toEqual({
      unit: "Litros",
    });
  });

  it("returns an empty object for null or non-object values", () => {
    expect(parseHabitGoalConfig(null)).toEqual({});
    expect(parseHabitGoalConfig(42)).toEqual({});
  });
});

describe("describeHabitFrequency", () => {
  it("labels every frequency type", () => {
    expect(describeHabitFrequency("daily")).toBe("Diária");
    expect(describeHabitFrequency("weekly")).toBe("Semanal");
    expect(describeHabitFrequency("monthly")).toBe("Mensal");
  });
});

describe("describeHabitGoal", () => {
  it("combines target, unit and the period suffix", () => {
    expect(describeHabitGoal({ frequencyType: "daily", target: 3, unit: "Litros" })).toBe(
      "3 Litros por dia",
    );
    expect(describeHabitGoal({ frequencyType: "weekly", target: 4, unit: "Sessões" })).toBe(
      "4 Sessões na semana",
    );
    expect(describeHabitGoal({ frequencyType: "monthly", target: 1, unit: "Livro" })).toBe(
      "1 Livro no mês",
    );
  });

  it("falls back to the frequency label when there is no numeric target/unit (checklist habits)", () => {
    expect(describeHabitGoal({ frequencyType: "daily" })).toBe("Diária");
    expect(describeHabitGoal({ frequencyType: "monthly", target: undefined, unit: undefined })).toBe(
      "Mensal",
    );
  });
});

describe("describeChallengeDisplayStatus", () => {
  it("has a label for every possible status", () => {
    const statuses = [
      "abandoned",
      "available",
      "coming_soon",
      "completed",
      "ended",
      "joined",
      "unavailable",
    ] as const;

    for (const status of statuses) {
      expect(typeof describeChallengeDisplayStatus(status)).toBe("string");
      expect(describeChallengeDisplayStatus(status).length).toBeGreaterThan(0);
    }
  });
});
