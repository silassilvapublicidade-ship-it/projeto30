import { describe, expect, it } from "vitest";

import { describeCronHealth, getNextExpectedCronRun } from "./cron-schedule.core";

describe("describeCronHealth", () => {
  it("is critico when the cron has never run", () => {
    expect(describeCronHealth(null).status).toBe("critico");
  });

  it("is saudavel within the expected daily window (<=26h since last run)", () => {
    const recent = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    expect(describeCronHealth(recent).status).toBe("saudavel");
  });

  it("is atencao for a moderate delay (26h-36h)", () => {
    const delayed = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    expect(describeCronHealth(delayed).status).toBe("atencao");
  });

  it("is critico beyond the maximum tolerance (>36h)", () => {
    const stale = new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString();
    expect(describeCronHealth(stale).status).toBe("critico");
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
