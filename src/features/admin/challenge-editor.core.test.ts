import { describe, expect, it } from "vitest";

import {
  classifyChallengeField,
  describeChallengeLifecycleStage,
  isFieldChangeAllowed,
  mergeJsonConfig,
  suggestChallengeSlug,
  validateChallengeForPublish,
} from "./challenge-editor.core";

describe("classifyChallengeField", () => {
  it("classifies text/copy fields as editorial", () => {
    expect(classifyChallengeField("name")).toBe("editorial");
    expect(classifyChallengeField("headline")).toBe("editorial");
    expect(classifyChallengeField("shortDescription")).toBe("editorial");
  });

  it("classifies duration/habits/dates as structural", () => {
    expect(classifyChallengeField("durationDays")).toBe("structural");
    expect(classifyChallengeField("habits")).toBe("structural");
    expect(classifyChallengeField("startDate")).toBe("structural");
  });

  it("classifies status/window/points as operational", () => {
    expect(classifyChallengeField("participantLimit")).toBe("operational");
    expect(classifyChallengeField("enrollmentStart")).toBe("operational");
    expect(classifyChallengeField("streakMinimumCompletion")).toBe("operational");
  });

  it("defaults unknown fields to structural (safest fallback: block first)", () => {
    expect(classifyChallengeField("somethingNew")).toBe("structural");
  });
});

describe("isFieldChangeAllowed", () => {
  it("allows every field when there are no participants yet", () => {
    expect(isFieldChangeAllowed("habits", false)).toBe(true);
    expect(isFieldChangeAllowed("durationDays", false)).toBe(true);
  });

  it("blocks structural fields once there are participants", () => {
    expect(isFieldChangeAllowed("habits", true)).toBe(false);
    expect(isFieldChangeAllowed("durationDays", true)).toBe(false);
  });

  it("keeps editorial and operational fields allowed even with participants", () => {
    expect(isFieldChangeAllowed("headline", true)).toBe(true);
    expect(isFieldChangeAllowed("participantLimit", true)).toBe(true);
  });
});

describe("mergeJsonConfig", () => {
  it("preserves unrelated existing keys", () => {
    const result = mergeJsonConfig({ scope: "public", visibility: "listed" }, { headline: "Novo" });
    expect(result).toEqual({ headline: "Novo", scope: "public", visibility: "listed" });
  });

  it("overwrites keys present in the patch", () => {
    const result = mergeJsonConfig({ headline: "Antigo" }, { headline: "Novo" });
    expect(result.headline).toBe("Novo");
  });

  it("removes a key when the patch value is undefined", () => {
    const result = mergeJsonConfig({ headline: "Antigo", tagline: "Mantido" }, { headline: undefined });
    expect(result).toEqual({ tagline: "Mantido" });
  });

  it("works from a null/undefined base (new challenge with empty config)", () => {
    expect(mergeJsonConfig(null, { headline: "Novo" })).toEqual({ headline: "Novo" });
    expect(mergeJsonConfig(undefined, { headline: "Novo" })).toEqual({ headline: "Novo" });
  });
});

describe("suggestChallengeSlug", () => {
  it("lowercases, strips accents and joins words with hyphens", () => {
    expect(suggestChallengeSlug("Desafio de Setembro: Foco Total!")).toBe(
      "desafio-de-setembro-foco-total",
    );
  });

  it("handles accented characters", () => {
    expect(suggestChallengeSlug("Irreconhecível em Ação")).toBe("irreconhecivel-em-acao");
  });

  it("never produces leading/trailing hyphens", () => {
    expect(suggestChallengeSlug("  --Teste--  ")).toBe("teste");
  });
});

describe("validateChallengeForPublish", () => {
  it("passes for a fully configured challenge", () => {
    const issues = validateChallengeForPublish({
      durationDays: 30,
      generatedDaysCount: 30,
      habitsCount: 5,
      name: "Desafio de Setembro",
      slug: "desafio-de-setembro",
    });
    expect(issues).toEqual([]);
  });

  it("flags a challenge with no habits", () => {
    const issues = validateChallengeForPublish({
      durationDays: 30,
      generatedDaysCount: 30,
      habitsCount: 0,
      name: "Desafio",
      slug: "desafio",
    });
    expect(issues.some((issue) => issue.includes("hábito"))).toBe(true);
  });

  it("flags a mismatch between generated days and configured duration", () => {
    const issues = validateChallengeForPublish({
      durationDays: 30,
      generatedDaysCount: 15,
      habitsCount: 3,
      name: "Desafio",
      slug: "desafio",
    });
    expect(issues.some((issue) => issue.includes("dias"))).toBe(true);
  });

  it("flags a missing name or slug", () => {
    const issues = validateChallengeForPublish({
      durationDays: 30,
      generatedDaysCount: 30,
      habitsCount: 3,
      name: "",
      slug: "",
    });
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("describeChallengeLifecycleStage", () => {
  it("returns draft for draft status regardless of participants", () => {
    expect(describeChallengeLifecycleStage("draft", false)).toBe("draft");
    expect(describeChallengeLifecycleStage("draft", true)).toBe("draft");
  });

  it("returns published_no_participants for active status with no participants", () => {
    expect(describeChallengeLifecycleStage("active", false)).toBe("published_no_participants");
  });

  it("returns published_with_participants for active status with participants", () => {
    expect(describeChallengeLifecycleStage("active", true)).toBe("published_with_participants");
  });

  it("returns ended for ended/archived regardless of participants", () => {
    expect(describeChallengeLifecycleStage("ended", true)).toBe("ended");
    expect(describeChallengeLifecycleStage("archived", false)).toBe("ended");
  });
});
