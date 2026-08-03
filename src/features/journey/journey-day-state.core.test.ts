import { describe, expect, it } from "vitest";

import { getJourneyDayState } from "./journey-day-state.core";

describe("getJourneyDayState", () => {
  it("marks the current day as today regardless of log state", () => {
    expect(
      getJourneyDayState({
        completionPercent: 0,
        dayNumber: 5,
        finalized: false,
        streakMinimumCompletion: 70,
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
        streakMinimumCompletion: 70,
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
        streakMinimumCompletion: 70,
        todayDayNumber: 5,
      }),
    ).toBe("completed");
  });

  it("marks a finalized past day at or above the streak minimum, below 100%, as partial_kept - real case: Silas's Dia 2, finalized at 50% with a 70% minimum was previously shown identically to a day that was never opened at all", () => {
    expect(
      getJourneyDayState({
        completionPercent: 50,
        dayNumber: 2,
        finalized: true,
        streakMinimumCompletion: 50,
        todayDayNumber: 3,
      }),
    ).toBe("partial_kept");
  });

  it("marks a finalized past day below the streak minimum as partial_lost - still finalized, just didn't keep the streak", () => {
    expect(
      getJourneyDayState({
        completionPercent: 40,
        dayNumber: 3,
        finalized: true,
        streakMinimumCompletion: 70,
        todayDayNumber: 5,
      }),
    ).toBe("partial_lost");
  });

  it("marks a finalized past day at exactly the streak minimum as partial_kept (>=, not >)", () => {
    expect(
      getJourneyDayState({
        completionPercent: 70,
        dayNumber: 3,
        finalized: true,
        streakMinimumCompletion: 70,
        todayDayNumber: 5,
      }),
    ).toBe("partial_kept");
  });

  it("marks a finalized past day at exactly 0% as partial_lost, never the same bucket as a day that was never opened - a finalized day is always finalizado regardless of percent", () => {
    expect(
      getJourneyDayState({
        completionPercent: 0,
        dayNumber: 3,
        finalized: true,
        streakMinimumCompletion: 70,
        todayDayNumber: 5,
      }),
    ).toBe("partial_lost");
  });

  it("marks an unfinalized past day (opened but never closed) as not_finalized, never partial - a day still open is not the same as a day finalized at a partial percent", () => {
    expect(
      getJourneyDayState({
        completionPercent: 100,
        dayNumber: 3,
        finalized: false,
        streakMinimumCompletion: 70,
        todayDayNumber: 5,
      }),
    ).toBe("not_finalized");
  });

  it("marks a past day with no log at all as not_finalized", () => {
    expect(
      getJourneyDayState({
        completionPercent: 0,
        dayNumber: 3,
        finalized: false,
        streakMinimumCompletion: 70,
        todayDayNumber: 5,
      }),
    ).toBe("not_finalized");
  });
});
