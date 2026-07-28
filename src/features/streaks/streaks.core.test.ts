import { describe, expect, it } from "vitest";

import { calculateStreak } from "./streaks.core";

describe("calculateStreak", () => {
  it("starts a new streak on the first valid day", () => {
    expect(
      calculateStreak({
        previousCurrent: 0,
        previousBest: 0,
        lastValidLogDate: null,
        logDate: "2026-07-01",
        dayQualifies: true,
      }),
    ).toEqual({
      current: 1,
      best: 1,
      broken: false,
      extended: true,
    });
  });

  it("extends a streak on consecutive dates", () => {
    expect(
      calculateStreak({
        previousCurrent: 6,
        previousBest: 6,
        lastValidLogDate: "2026-07-06",
        logDate: "2026-07-07",
        dayQualifies: true,
      }),
    ).toMatchObject({
      current: 7,
      best: 7,
      extended: true,
    });
  });

  it("keeps best streak when a day does not qualify", () => {
    expect(
      calculateStreak({
        previousCurrent: 7,
        previousBest: 10,
        lastValidLogDate: "2026-07-07",
        logDate: "2026-07-08",
        dayQualifies: false,
      }),
    ).toEqual({
      current: 0,
      best: 10,
      broken: true,
      extended: false,
    });
  });

  it("restarts after a gap without erasing the best streak", () => {
    expect(
      calculateStreak({
        previousCurrent: 4,
        previousBest: 9,
        lastValidLogDate: "2026-07-04",
        logDate: "2026-07-07",
        dayQualifies: true,
      }),
    ).toEqual({
      current: 1,
      best: 9,
      broken: true,
      extended: true,
    });
  });
});
