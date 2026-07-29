import { describe, expect, it } from "vitest";

import { getHabitPeriodRange } from "./habit-period.core";

describe("getHabitPeriodRange", () => {
  it("returns the Monday-Sunday week containing a mid-week date", () => {
    // 2026-08-05 is a Wednesday
    expect(getHabitPeriodRange("2026-08-05", "weekly")).toEqual({
      end: "2026-08-09",
      start: "2026-08-03",
    });
  });

  it("returns the same week for both boundary days (Monday and Sunday)", () => {
    expect(getHabitPeriodRange("2026-08-03", "weekly")).toEqual({
      end: "2026-08-09",
      start: "2026-08-03",
    });
    expect(getHabitPeriodRange("2026-08-09", "weekly")).toEqual({
      end: "2026-08-09",
      start: "2026-08-03",
    });
  });

  it("handles a week that crosses a month boundary", () => {
    // 2026-08-01 is a Saturday, so its week starts in July
    expect(getHabitPeriodRange("2026-08-01", "weekly")).toEqual({
      end: "2026-08-02",
      start: "2026-07-27",
    });
  });

  it("returns the full calendar month for a monthly habit", () => {
    expect(getHabitPeriodRange("2026-08-15", "monthly")).toEqual({
      end: "2026-08-31",
      start: "2026-08-01",
    });
  });

  it("returns the same month range for the first and last day of the month", () => {
    expect(getHabitPeriodRange("2026-08-01", "monthly")).toEqual({
      end: "2026-08-31",
      start: "2026-08-01",
    });
    expect(getHabitPeriodRange("2026-08-31", "monthly")).toEqual({
      end: "2026-08-31",
      start: "2026-08-01",
    });
  });

  it("handles February in a leap year correctly", () => {
    expect(getHabitPeriodRange("2028-02-10", "monthly")).toEqual({
      end: "2028-02-29",
      start: "2028-02-01",
    });
  });
});
