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
    expect(getChallengeCta("joined", false)).toEqual({
      disabled: false,
      kind: "continue",
      label: "Continuar desafio",
    });
  });

  it("blocks joining an available challenge when another one is active elsewhere", () => {
    const cta = getChallengeCta("available", true);
    expect(cta.kind).toBe("blocked");
    expect(cta.disabled).toBe(true);
    expect(cta.label).toBe("Você já está participando de outro desafio");
  });

  it("allows joining an available challenge when nothing else is active", () => {
    expect(getChallengeCta("available", false)).toEqual({
      disabled: false,
      kind: "join",
      label: "Participar",
    });
  });

  it("never offers to join non-available, non-joined statuses even without a conflicting enrollment", () => {
    const nonJoinable = ["completed", "abandoned", "coming_soon", "ended", "unavailable"] as const;

    for (const status of nonJoinable) {
      const cta = getChallengeCta(status, false);
      expect(cta.kind).not.toBe("join");
    }
  });

  it("marks a completed challenge as informational and disabled", () => {
    expect(getChallengeCta("completed", false)).toEqual({
      disabled: true,
      kind: "info",
      label: "Desafio concluído",
    });
  });
});

describe("parseChallengeThemeConfig", () => {
  it("reads only the known string keys, ignoring unrelated/legacy keys", () => {
    expect(
      parseChallengeThemeConfig({
        campaign: "agosto_2026",
        cta_label: "Vem comigo!",
        short_title: "Irreconhecível em Agosto",
        subtitle: "Pequenas escolhas diárias, grandes resultados para sempre.",
      }),
    ).toEqual({
      cta_label: "Vem comigo!",
      short_title: "Irreconhecível em Agosto",
      subtitle: "Pequenas escolhas diárias, grandes resultados para sempre.",
    });
  });

  it("returns an empty object for null, non-object or empty-string values", () => {
    expect(parseChallengeThemeConfig(null)).toEqual({});
    expect(parseChallengeThemeConfig("not-json")).toEqual({});
    expect(parseChallengeThemeConfig({ short_title: "" })).toEqual({});
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
