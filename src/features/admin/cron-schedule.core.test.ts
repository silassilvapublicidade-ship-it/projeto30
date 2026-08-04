import { describe, expect, it } from "vitest";

import { describeCronEvidenceLabel, describeCronHealth, getNextExpectedCronRun } from "./cron-schedule.core";

describe("describeCronHealth - never recomputes severity, only labels what the server already decided", () => {
  it("is saudavel when the server confirms recent evidence", () => {
    expect(describeCronHealth({ cronHasRecentEvidence: true, overdueScheduledCampaigns: 0 }).status).toBe("saudavel");
  });

  it("is atencao when there is no recent evidence but no overdue work - never critico for absence alone", () => {
    const result = describeCronHealth({ cronHasRecentEvidence: false, overdueScheduledCampaigns: 0 });
    expect(result.status).toBe("atencao");
    expect(result.label).not.toMatch(/nunca/i);
  });

  it("is critico only when no recent evidence AND real overdue work exists", () => {
    const result = describeCronHealth({ cronHasRecentEvidence: false, overdueScheduledCampaigns: 3 });
    expect(result.status).toBe("critico");
    expect(result.label).toContain("3");
  });

  it("recent evidence with overdue campaigns is still saudavel - overdue alone isn't the trigger, staleness is", () => {
    expect(describeCronHealth({ cronHasRecentEvidence: true, overdueScheduledCampaigns: 5 }).status).toBe("saudavel");
  });
});

describe("describeCronEvidenceLabel", () => {
  const now = new Date("2026-08-04T22:00:00Z");

  it("prefers the direct cron record when available", () => {
    const label = describeCronEvidenceLabel(
      { lastCronRun: { lastSeenAt: "2026-08-04T12:00:00Z" }, lastAutomationActivityAt: null },
      now,
    );
    expect(label).toContain("Confirmado");
    expect(label).toContain("10h");
  });

  it("falls back to real automation activity, never claiming a direct confirmation it doesn't have", () => {
    const label = describeCronEvidenceLabel(
      { lastCronRun: null, lastAutomationActivityAt: "2026-08-04T12:21:00Z" },
      now,
    );
    expect(label).toContain("Atividade automática");
    expect(label).not.toContain("Confirmado");
  });

  it("never says 'nunca rodou' - says it's awaiting the first execution instead", () => {
    const label = describeCronEvidenceLabel({ lastCronRun: null, lastAutomationActivityAt: null }, now);
    expect(label).not.toMatch(/nunca rodou/i);
    expect(label).toMatch(/aguardando/i);
  });
});

describe("getNextExpectedCronRun", () => {
  it("returns today's 12:00 UTC when now is before that", () => {
    const now = new Date("2026-08-04T08:00:00Z");
    const next = getNextExpectedCronRun(now);
    expect(next.toISOString()).toBe("2026-08-04T12:00:00.000Z");
  });

  it("returns tomorrow's 12:00 UTC when now is after today's run", () => {
    const now = new Date("2026-08-04T15:00:00Z");
    const next = getNextExpectedCronRun(now);
    expect(next.toISOString()).toBe("2026-08-05T12:00:00.000Z");
  });

  it("never predicts more than once per day, matching the real Vercel Hobby-plan cron limit", () => {
    const now = new Date("2026-08-04T08:00:00Z");
    const next = getNextExpectedCronRun(now);
    const diffHours = (next.getTime() - now.getTime()) / (60 * 60 * 1000);
    expect(diffHours).toBeLessThanOrEqual(24);
  });
});
