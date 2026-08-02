import { describe, expect, it } from "vitest";

import { resolveDailyPrompt, resolveGoalLabel } from "./habit-daily-prompt.core";

describe("resolveDailyPrompt", () => {
  it("uses the authored daily_prompt when present", () => {
    expect(
      resolveDailyPrompt({
        daily_prompt: "Bebeu pelo menos 3 litros de água hoje?",
        title: "Beber no mínimo 3 litros de água",
      }),
    ).toBe("Bebeu pelo menos 3 litros de água hoje?");
  });

  it("trims whitespace-only daily_prompt and falls back", () => {
    expect(
      resolveDailyPrompt({
        daily_prompt: "   ",
        title: "Fazer cardio",
      }),
    ).toBe("Fazer cardio hoje?");
  });

  it("falls back to validation_config.short_title when daily_prompt is null", () => {
    expect(
      resolveDailyPrompt({
        daily_prompt: null,
        title: "Fazer musculação 4 vezes por semana",
        validation_config: { short_title: "Musculação" },
      }),
    ).toBe("Musculação hoje?");
  });

  it("falls back to the raw title when neither daily_prompt nor short_title exist - never an empty heading", () => {
    expect(
      resolveDailyPrompt({
        daily_prompt: null,
        title: "Novo hábito sem configuração",
      }),
    ).toBe("Novo hábito sem configuração hoje?");
  });

  it("ignores a malformed validation_config instead of throwing", () => {
    expect(
      resolveDailyPrompt({
        daily_prompt: null,
        title: "Hábito",
        validation_config: "not-an-object",
      }),
    ).toBe("Hábito hoje?");
  });
});

describe("resolveGoalLabel", () => {
  it("formats a weekly target with its unit, lowercased", () => {
    expect(
      resolveGoalLabel({
        frequency_type: "weekly",
        validation_config: { target: 4, unit: "Sessoes" },
      }),
    ).toBe("Meta semanal: 4 sessoes");
  });

  it("formats a monthly target", () => {
    expect(
      resolveGoalLabel({
        frequency_type: "monthly",
        validation_config: { target: 1, unit: "Livro" },
      }),
    ).toBe("Meta mensal: 1 livro");
  });

  it("formats a daily target", () => {
    expect(
      resolveGoalLabel({
        frequency_type: "daily",
        validation_config: { target: 3, unit: "Litros" },
      }),
    ).toBe("Meta diária: 3 litros");
  });

  it("omits the unit when absent", () => {
    expect(
      resolveGoalLabel({
        frequency_type: "monthly",
        validation_config: { target: 2 },
      }),
    ).toBe("Meta mensal: 2");
  });

  it("returns null when there's no target to show (plain yes/no habit)", () => {
    expect(
      resolveGoalLabel({
        frequency_type: "daily",
        validation_config: { short_title: "Sem cafeína" },
      }),
    ).toBeNull();
  });

  it("returns null for a missing/malformed validation_config", () => {
    expect(resolveGoalLabel({ frequency_type: "daily" })).toBeNull();
  });
});
