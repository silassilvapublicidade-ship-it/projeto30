import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("member-area.service.ts - backend-enforced habit visibility (Parte 13)", () => {
  const source = readSource("src", "server", "services", "member-area.service.ts");

  it("filters out non-visible items before they ever become a TodayMission - never a client-side-only filter", () => {
    const fnStart = source.indexOf("const todayMissions = (dayHabitRows ?? []).flatMap<TodayMission>");
    const fnEnd = source.indexOf("return {", fnStart);
    const body = source.slice(fnStart, fnEnd);
    expect(body).toContain("isHabitVisibleOnDay(habit.visibility_config, currentDay, durationDays)");
    // the visibility check must run BEFORE the mission object is constructed
    const visibilityCheckIndex = body.indexOf("isHabitVisibleOnDay");
    const missionBuildIndex = body.indexOf("actionLabel: getMissionActionLabel(state)");
    expect(visibilityCheckIndex).toBeGreaterThan(-1);
    expect(missionBuildIndex).toBeGreaterThan(visibilityCheckIndex);
  });

  it("selects visibility_config from habits so the filter has real data to check", () => {
    expect(source).toContain(
      "id,title,description,category,habit_type,icon,points,validation_config,sort_order,frequency_type,daily_prompt,visibility_config",
    );
  });

  it("threads durationDays from the real challenge, not a guessed constant", () => {
    expect(source).toContain("durationDays: challenge?.duration_days ?? Math.max(1, activeEnrollment.current_day)");
  });

  it("exposes streakMinimumCompletion on TodayProgress so the UI can explain the streak outside the finalize moment too", () => {
    expect(source).toContain("streakMinimumCompletion: number;");
    expect(source).toContain('streakMinimumCompletion: getRuleInt(rulesConfig, "streak_minimum_completion", 70),');
  });

  it("reuses the shared readRuleInt instead of keeping its own private copy", () => {
    expect(source).toContain(
      'import { readRuleInt as getRuleInt } from "@/features/journey/rules.core";',
    );
    expect(source).not.toContain("function getRuleInt(rulesConfig");
  });
});

describe("journey.service.ts - Jornada summary also exposes streakMinimumCompletion", () => {
  const source = readSource("src", "server", "services", "journey.service.ts");

  it("reads it from the same shared helper as member-area.service.ts", () => {
    expect(source).toContain(
      'import { readStreakMinimumCompletion } from "@/features/journey/rules.core";',
    );
    expect(source).toContain("streakMinimumCompletion: readStreakMinimumCompletion(challenge.rules_config),");
  });
});
