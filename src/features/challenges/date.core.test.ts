import { describe, expect, it } from "vitest";

import { calculateChallengeDay, getDateOnlyInTimeZone } from "./date.core";

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
