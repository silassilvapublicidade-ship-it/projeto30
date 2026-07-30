import { describe, expect, it } from "vitest";

import { getJourneyDayState } from "./journey-day-state.core";

describe("getJourneyDayState", () => {
  it("marks the current day as today regardless of log state", () => {
    expect(
      getJourneyDayState({
        completionPercent: 0,
        dayNumber: 5,
        finalized: false,
        hasLog: false,
        todayDayNumber: 5,
      }),
    ).toBe("today");
  });

  it("blocks any day after the current one as future, even with a stray log", () => {
    expect(
      getJourneyDayState({
        completionPercent: 100,
        dayNumber: 6,
        finalized: true,
        hasLog: true,
        todayDayNumber: 5,
      }),
    ).toBe("future");
  });

  it("marks a fully finalized past day as completed", () => {
    expect(
      getJourneyDayState({
        completionPercent: 100,
        dayNumber: 3,
        finalized: true,
        hasLog: true,
        todayDayNumber: 5,
      }),
    ).toBe("completed");
  });

  it("marks a finalized past day with partial completion as partial", () => {
    expect(
      getJourneyDayState({
        completionPercent: 40,
        dayNumber: 3,
        finalized: true,
        hasLog: true,
        todayDayNumber: 5,
      }),
    ).toBe("partial");
  });

  it("marks an unfinalized past day that has a log as partial (never silently completed)", () => {
    expect(
      getJourneyDayState({
        completionPercent: 100,
        dayNumber: 3,
        finalized: false,
        hasLog: true,
        todayDayNumber: 5,
      }),
    ).toBe("partial");
  });

  it("marks a past day with no log at all as missed", () => {
    expect(
      getJourneyDayState({
        completionPercent: 0,
        dayNumber: 3,
        finalized: false,
        hasLog: false,
        todayDayNumber: 5,
      }),
    ).toBe("missed");
  });

  it("marks a past day finalized at exactly 0% as missed, not partial", () => {
    expect(
      getJourneyDayState({
        completionPercent: 0,
        dayNumber: 3,
        finalized: true,
        hasLog: true,
        todayDayNumber: 5,
      }),
    ).toBe("missed");
  });
});
