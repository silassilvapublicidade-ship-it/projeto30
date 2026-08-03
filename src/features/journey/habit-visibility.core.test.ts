import { describe, expect, it } from "vitest";

import { describeHabitVisibility, isHabitVisibleOnDay } from "./habit-visibility.core";

describe("isHabitVisibleOnDay", () => {
  it("all_days is always visible", () => {
    expect(isHabitVisibleOnDay({ type: "all_days" }, 1, 31)).toBe(true);
    expect(isHabitVisibleOnDay({ type: "all_days" }, 31, 31)).toBe(true);
  });

  it("first_day is only visible on day 1", () => {
    expect(isHabitVisibleOnDay({ type: "first_day" }, 1, 31)).toBe(true);
    expect(isHabitVisibleOnDay({ type: "first_day" }, 2, 31)).toBe(false);
  });

  it("last_day resolves against the real duration, not a hardcoded day number", () => {
    expect(isHabitVisibleOnDay({ type: "last_day" }, 31, 31)).toBe(true);
    expect(isHabitVisibleOnDay({ type: "last_day" }, 30, 31)).toBe(false);
    expect(isHabitVisibleOnDay({ type: "last_day" }, 14, 14)).toBe(true);
  });

  it("from_day is inclusive of the boundary", () => {
    expect(isHabitVisibleOnDay({ day: 25, type: "from_day" }, 25, 31)).toBe(true);
    expect(isHabitVisibleOnDay({ day: 25, type: "from_day" }, 24, 31)).toBe(false);
    expect(isHabitVisibleOnDay({ day: 25, type: "from_day" }, 31, 31)).toBe(true);
  });

  it("between_days is inclusive on both ends", () => {
    expect(isHabitVisibleOnDay({ from: 5, to: 10, type: "between_days" }, 5, 31)).toBe(true);
    expect(isHabitVisibleOnDay({ from: 5, to: 10, type: "between_days" }, 10, 31)).toBe(true);
    expect(isHabitVisibleOnDay({ from: 5, to: 10, type: "between_days" }, 4, 31)).toBe(false);
    expect(isHabitVisibleOnDay({ from: 5, to: 10, type: "between_days" }, 11, 31)).toBe(false);
  });

  it("specific_days covers the 'primeiro e ultimo dia' (fotos de evolução) example exactly", () => {
    const config = { days: [1, 31], type: "specific_days" as const };
    expect(isHabitVisibleOnDay(config, 1, 31)).toBe(true);
    expect(isHabitVisibleOnDay(config, 31, 31)).toBe(true);
    expect(isHabitVisibleOnDay(config, 15, 31)).toBe(false);
  });

  it("an unknown/malformed config falls back to visible - never silently disappears an item", () => {
    expect(isHabitVisibleOnDay({ type: "something_new" }, 5, 31)).toBe(true);
    expect(isHabitVisibleOnDay(null, 5, 31)).toBe(true);
    expect(isHabitVisibleOnDay({ day: "not-a-number", type: "from_day" }, 5, 31)).toBe(false);
  });
});

describe("describeHabitVisibility", () => {
  it("describes the 'Concluir o livro do mês' real-world case (last_day)", () => {
    expect(describeHabitVisibility({ type: "last_day" }, 31)).toBe("Aparece no Dia 31");
  });

  it("describes specific_days with the exact day list", () => {
    expect(describeHabitVisibility({ days: [1, 31], type: "specific_days" }, 31)).toBe(
      "Aparece nos dias 1, 31",
    );
  });

  it("falls back to the all_days label for a missing/unknown config", () => {
    expect(describeHabitVisibility(null, 31)).toBe("Todos os dias");
  });
});
