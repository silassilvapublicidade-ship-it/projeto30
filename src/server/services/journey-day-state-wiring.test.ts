import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "services", "journey.service.ts"), "utf8");
}

/**
 * Real production bug this locks in (Silas's Dia 2: finalized at 50%,
 * still counted as "days remaining" because daysRemaining only excluded
 * state === "completed" days). A finalized day - at any percent - is a day
 * already lived; it must never inflate "dias restantes".
 */
describe("journey.service.ts - getJourneyDetail wiring for the finalized/partial state fix", () => {
  const source = readSource();

  it("computes streakMinimumCompletion once, before building calendarDays, and reuses it for every getJourneyDayState call", () => {
    const streakDeclIndex = source.indexOf(
      "const streakMinimumCompletion = readStreakMinimumCompletion(challenge.rules_config);",
    );
    const calendarDaysIndex = source.indexOf("const calendarDays: JourneyCalendarDay[]");
    const selectedDayStateIndex = source.lastIndexOf("const state = getJourneyDayState({");

    expect(streakDeclIndex).toBeGreaterThan(-1);
    expect(streakDeclIndex).toBeLessThan(calendarDaysIndex);
    expect(streakDeclIndex).toBeLessThan(selectedDayStateIndex);
  });

  it("both getJourneyDayState call sites pass streakMinimumCompletion, never hardcoding a fresh 70/100", () => {
    const occurrences = source.match(/getJourneyDayState\(\{[^}]*streakMinimumCompletion,/g) ?? [];
    expect(occurrences.length).toBe(2);
  });

  it("daysFinalized counts every finalized state (completed/partial_kept/partial_lost), not just the 100% one - the actual fix for the 'dias restantes' inflation bug", () => {
    const fnStart = source.indexOf('const daysFinalized = calendarDays.filter((day) =>');
    const fnEnd = source.indexOf(");", fnStart);
    const block = source.slice(fnStart, fnEnd);

    expect(block).toContain('"completed"');
    expect(block).toContain('"partial_kept"');
    expect(block).toContain('"partial_lost"');
    expect(block).not.toContain('day.state === "completed"');
  });

  it("daysRemaining is derived from daysFinalized, never from a re-filtered completed-only count", () => {
    expect(source).toContain("daysRemaining: Math.max(0, challenge.duration_days - daysFinalized),");
  });
});
