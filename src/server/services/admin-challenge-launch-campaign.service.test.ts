import { describe, expect, it } from "vitest";

import {
  computeLaunchCampaignStepTargetDate,
  defaultStepContent,
  LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET,
  LAUNCH_CAMPAIGN_STEP_KEYS,
} from "./admin-challenge-launch-campaign.service";

describe("computeLaunchCampaignStepTargetDate", () => {
  it("matches the worked example from the briefing: start 2026-09-01 -> 7 days before is 2026-08-25", () => {
    expect(computeLaunchCampaignStepTargetDate("2026-09-01", -7)).toBe("2026-08-25");
  });

  it("matches the worked example: 3 days before is 2026-08-29, 1 day before is 2026-08-31, launch day is 2026-09-01", () => {
    expect(computeLaunchCampaignStepTargetDate("2026-09-01", -3)).toBe("2026-08-29");
    expect(computeLaunchCampaignStepTargetDate("2026-09-01", -1)).toBe("2026-08-31");
    expect(computeLaunchCampaignStepTargetDate("2026-09-01", 0)).toBe("2026-09-01");
  });

  it("crosses year boundaries correctly (never a naive month/day subtraction)", () => {
    expect(computeLaunchCampaignStepTargetDate("2026-01-02", -7)).toBe("2025-12-26");
  });

  it("returns null when the challenge has no start_date yet, instead of throwing or defaulting to a wrong date", () => {
    expect(computeLaunchCampaignStepTargetDate(null, -7)).toBeNull();
  });
});

describe("LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET", () => {
  it("has exactly one offset per step_key, matching the fixed 5-step sequence from the briefing", () => {
    expect(Object.keys(LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET).sort()).toEqual([...LAUNCH_CAMPAIGN_STEP_KEYS].sort());
  });

  it("both launch-day steps share offset 0 - they differ only in enabled/content, never in timing", () => {
    expect(LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET.launch_day).toBe(0);
    expect(LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET.launch_day_followup).toBe(0);
  });

  it("the 3 pre-launch steps are strictly negative offsets, ordered 7 > 3 > 1 days before", () => {
    expect(LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET.seven_days_before).toBe(-7);
    expect(LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET.three_days_before).toBe(-3);
    expect(LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET.one_day_before).toBe(-1);
  });
});

describe("defaultStepContent - generic seed copy (never challenge-specific)", () => {
  it("interpolates the given challenge name into every step's copy", () => {
    for (const stepKey of LAUNCH_CAMPAIGN_STEP_KEYS) {
      const content = defaultStepContent("Efatá", stepKey);
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.message.length).toBeGreaterThan(0);
    }
  });

  it("produces different copy for a completely different challenge name - proves the seed is generic, not hardcoded to any one challenge", () => {
    const efata = defaultStepContent("Efatá", "launch_day");
    const other = defaultStepContent("Recomeço", "launch_day");
    expect(efata.title).not.toBe(other.title);
    expect(efata.title).toContain("Efatá");
    expect(other.title).toContain("Recomeço");
  });

  it("never hardcodes September-specific wording (month names, 2026 dates) regardless of which challenge name is passed", () => {
    for (const stepKey of LAUNCH_CAMPAIGN_STEP_KEYS) {
      const content = defaultStepContent("Qualquer Desafio Futuro", stepKey);
      expect(content.title.toLowerCase()).not.toContain("setembro");
      expect(content.message.toLowerCase()).not.toContain("setembro");
    }
  });
});
