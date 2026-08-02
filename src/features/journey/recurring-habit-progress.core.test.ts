import { describe, expect, it } from "vitest";

import {
  computeRecurringProgressPercent,
  formatRecurringProgressLabel,
} from "./recurring-habit-progress.core";

describe("formatRecurringProgressLabel", () => {
  it("formats a weekly habit with a target", () => {
    expect(formatRecurringProgressLabel({ completed: 3, frequencyType: "weekly", target: 4 })).toBe(
      "3 de 4 esta semana",
    );
  });

  it("formats a monthly habit with a target", () => {
    expect(formatRecurringProgressLabel({ completed: 1, frequencyType: "monthly", target: 1 })).toBe(
      "1 de 1 este mês",
    );
  });

  it("formats a daily habit's cycle-to-date adherence", () => {
    expect(formatRecurringProgressLabel({ completed: 31, frequencyType: "daily", target: 31 })).toBe(
      "31 de 31 no ciclo",
    );
  });

  it("falls back to a plain count (singular) when there's no target", () => {
    expect(formatRecurringProgressLabel({ completed: 1, frequencyType: "monthly", target: null })).toBe(
      "1 dia este mês",
    );
  });

  it("falls back to a plain count (plural) when there's no target", () => {
    expect(formatRecurringProgressLabel({ completed: 12, frequencyType: "monthly", target: null })).toBe(
      "12 dias este mês",
    );
  });
});

describe("computeRecurringProgressPercent", () => {
  it("computes a rounded percentage", () => {
    expect(computeRecurringProgressPercent({ completed: 3, frequencyType: "weekly", target: 4 })).toBe(
      75,
    );
  });

  it("caps at 100 even if completed exceeds target", () => {
    expect(computeRecurringProgressPercent({ completed: 5, frequencyType: "weekly", target: 4 })).toBe(
      100,
    );
  });

  it("returns null when target is null - nothing to compute a fraction against", () => {
    expect(
      computeRecurringProgressPercent({ completed: 5, frequencyType: "monthly", target: null }),
    ).toBeNull();
  });

  it("returns null when target is zero or negative - avoids a division by zero", () => {
    expect(computeRecurringProgressPercent({ completed: 0, frequencyType: "weekly", target: 0 })).toBeNull();
  });
});
