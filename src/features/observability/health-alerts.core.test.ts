import { describe, expect, it } from "vitest";

import { buildHealthAlerts, type HealthAlertInput } from "./health-alerts.core";

const baseline: HealthAlertInput = {
  openCriticalErrors24h: 0,
  campaignsFailed24h: 0,
  campaignsPartial24h: 0,
  deliveriesRetry: 0,
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
    expect(alerts.some((alert) => alert.title === "HTTP 410")).toBe(false);
    expect(alerts.every((alert) => alert.description.length > 20)).toBe(true);
  });

  it("surfaces open critical errors as the top-priority critical alert, with a link into Observabilidade", () => {
    const alerts = buildHealthAlerts({ ...baseline, openCriticalErrors24h: 2 });
    expect(alerts[0]!.tone).toBe("critical");
    expect(alerts[0]!.title).toContain("2");
    expect(alerts[0]!.href).toBe("/admin/observabilidade?severity=critical");
  });

  it("explains a failed campaign as critical with impact and suggested action", () => {
    const alerts = buildHealthAlerts({ ...baseline, campaignsFailed24h: 2 });
    expect(alerts[0]!.tone).toBe("critical");
    expect(alerts[0]!.title).toContain("2");
    expect(alerts[0]!.description).toMatch(/Notificações/i);
  });

  it("only flags a deliveries retry backlog at 10+ - a handful of temporary retries is normal, not an alert", () => {
    expect(buildHealthAlerts({ ...baseline, deliveriesRetry: 3 })).toEqual([]);
    const alerts = buildHealthAlerts({ ...baseline, deliveriesRetry: 10 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.tone).toBe("warning");
  });

  it("only flags revoked push subscriptions at abnormal volume (10+), not every routine revoke", () => {
    expect(buildHealthAlerts({ ...baseline, subscriptionsRevoked24h: 5 })).toEqual([]);
    const alerts = buildHealthAlerts({ ...baseline, subscriptionsRevoked24h: 10 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.tone).toBe("info");
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

  it("orders alerts by priority: critical errors, cron, campaign failed, campaign partial, retry backlog, uploads, cards, onboarding, subscriptions", () => {
    const alerts = buildHealthAlerts({
      openCriticalErrors24h: 1,
      campaignsFailed24h: 1,
      campaignsPartial24h: 1,
      deliveriesRetry: 10,
      subscriptionsRevoked24h: 10,
      cardsFailed24h: 1,
      uploadsFailed24h: 1,
      onboardingStuck: 5,
      lastCronRun: null,
    });

    const titles = alerts.map((alert) => alert.title);
    expect(titles[0]).toMatch(/erro\(s\) crítico\(s\)/);
    expect(titles[1]).toMatch(/nunca rodou/);
    expect(titles[2]).toMatch(/campanha\(s\) de notificação falharam/);
    expect(titles[3]).toMatch(/entregaram só parcialmente/);
    expect(titles[4]).toMatch(/acumuladas em nova tentativa/);
    expect(titles[5]).toMatch(/upload\(s\) falharam/);
    expect(titles[6]).toMatch(/card\(s\) de compartilhamento/);
    expect(titles[7]).toMatch(/presos no onboarding/);
    expect(titles[8]).toMatch(/pararam de aceitar push/);
  });
});
