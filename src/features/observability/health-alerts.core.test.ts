import { describe, expect, it } from "vitest";

import { buildHealthAlerts, type HealthAlertInput } from "./health-alerts.core";

const baseline: HealthAlertInput = {
  campaignsFailed24h: 0,
  campaignsPartial24h: 0,
  subscriptionsRevoked24h: 0,
  cardsFailed24h: 0,
  uploadsFailed24h: 0,
  onboardingStuck: 0,
  lastCronRun: { lastSeenAt: new Date().toISOString() },
};

describe("buildHealthAlerts", () => {
  it("returns no alerts when everything is healthy", () => {
    expect(buildHealthAlerts(baseline)).toEqual([]);
  });

  it("never explains a failure with just a raw code - every alert has an explanatory description", () => {
    const alerts = buildHealthAlerts({ ...baseline, campaignsFailed24h: 3 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.title).not.toBe("HTTP 410");
    expect(alerts[0]!.description.length).toBeGreaterThan(20);
  });

  it("explains a failed campaign as critical with impact and suggested action", () => {
    const alerts = buildHealthAlerts({ ...baseline, campaignsFailed24h: 2 });
    expect(alerts[0]!.tone).toBe("critical");
    expect(alerts[0]!.title).toContain("2");
    expect(alerts[0]!.description).toMatch(/Notificações/i);
  });

  it("describes revoked push subscriptions as informational, already handled automatically", () => {
    const alerts = buildHealthAlerts({ ...baseline, subscriptionsRevoked24h: 5 });
    expect(alerts[0]!.tone).toBe("info");
    expect(alerts[0]!.description).toMatch(/já foram revogadas automaticamente/i);
  });

  it("only flags onboarding as stuck at 5+ users, never for a single new signup", () => {
    expect(buildHealthAlerts({ ...baseline, onboardingStuck: 1 })).toEqual([]);
    expect(buildHealthAlerts({ ...baseline, onboardingStuck: 5 })).toHaveLength(1);
  });

  it("flags cron as critical when it has never run", () => {
    const alerts = buildHealthAlerts({ ...baseline, lastCronRun: null });
    expect(alerts.some((alert) => alert.tone === "critical" && /nunca rodou/i.test(alert.title))).toBe(true);
  });

  it("flags cron as critical when the last run is older than 36 hours", () => {
    const staleRun = { lastSeenAt: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString() };
    const alerts = buildHealthAlerts({ ...baseline, lastCronRun: staleRun });
    expect(alerts.some((alert) => alert.tone === "critical" && /36 horas/i.test(alert.title))).toBe(true);
  });

  it("does not flag cron when the last run was recent", () => {
    const recentRun = { lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() };
    expect(buildHealthAlerts({ ...baseline, lastCronRun: recentRun })).toEqual([]);
  });

  it("can surface multiple independent alerts at once", () => {
    const alerts = buildHealthAlerts({
      ...baseline,
      cardsFailed24h: 2,
      uploadsFailed24h: 1,
      campaignsPartial24h: 1,
    });
    expect(alerts).toHaveLength(3);
  });
});
