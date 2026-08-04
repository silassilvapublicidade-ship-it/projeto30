import { describe, expect, it } from "vitest";

import { calculateChallengeDay, getDateOnlyInTimeZone, getPreviousDateOnly } from "./date.core";

describe("calculateChallengeDay", () => {
  it("returns day 1 on the personal start date", () => {
    expect(
      calculateChallengeDay({
        personalStartDate: "2026-07-01",
        targetDate: "2026-07-01",
        durationDays: 30,
      }),
    ).toEqual({
      dayNumber: 1,
      daysElapsed: 0,
      status: "active",
    });
  });

  it("caps the day number after the challenge duration", () => {
    expect(
      calculateChallengeDay({
        personalStartDate: "2026-07-01",
        targetDate: "2026-08-15",
        durationDays: 30,
      }),
    ).toMatchObject({
      dayNumber: 30,
      status: "completed",
    });
  });

  it("detects dates before the start", () => {
    expect(
      calculateChallengeDay({
        personalStartDate: "2026-07-10",
        targetDate: "2026-07-09",
        durationDays: 30,
      }),
    ).toMatchObject({
      dayNumber: 0,
      status: "not_started",
    });
  });
});

describe("getDateOnlyInTimeZone", () => {
  it("formats a date for the requested timezone", () => {
    expect(
      getDateOnlyInTimeZone(new Date("2026-07-02T02:30:00.000Z"), "America/Sao_Paulo"),
    ).toBe("2026-07-01");
  });
});

describe("getPreviousDateOnly - auditoria de produto, item 03 ('hoje você fez mais que ontem')", () => {
  it("returns the calendar day immediately before an ordinary date", () => {
    expect(getPreviousDateOnly("2026-08-03")).toBe("2026-08-02");
  });

  it("crosses a month boundary correctly", () => {
    expect(getPreviousDateOnly("2026-08-01")).toBe("2026-07-31");
  });

  it("crosses a year boundary correctly", () => {
    expect(getPreviousDateOnly("2026-01-01")).toBe("2025-12-31");
  });

  it("handles a leap-year February correctly", () => {
    expect(getPreviousDateOnly("2028-03-01")).toBe("2028-02-29");
  });
});
