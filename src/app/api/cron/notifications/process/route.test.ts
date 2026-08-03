import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "app", "api", "cron", "notifications", "process", "route.ts"),
    "utf8",
  );
}

describe("/api/cron/notifications/process - safety contract", () => {
  const source = readSource();

  it("refuses to run if CRON_CONTROL_SECRET is not configured, rather than falling open", () => {
    expect(source).toContain("if (!env.CRON_CONTROL_SECRET) {");
    expect(source).toContain("status: 503");
  });

  it("requires the exact bearer secret, rejecting any other or missing Authorization header", () => {
    expect(source).toContain('authHeader !== `Bearer ${env.CRON_CONTROL_SECRET}`');
    expect(source).toContain("status: 401");
  });

  it("runs all three phases in order: due scheduled campaigns, push retries, then automations", () => {
    const bodyStart = source.indexOf("export async function POST");
    const body = source.slice(bodyStart);
    const scheduledIdx = body.indexOf("processDueScheduledCampaigns()");
    const retryIdx = body.indexOf("retryDueNotificationDeliveries()");
    const automationsIdx = body.indexOf("runAllScheduledAutomations()");
    expect(scheduledIdx).toBeGreaterThan(-1);
    expect(retryIdx).toBeGreaterThan(scheduledIdx);
    expect(automationsIdx).toBeGreaterThan(retryIdx);
  });

  it("GET (Vercel Cron's own invocation) forwards to the same authenticated POST handler, never a separate unauthenticated path", () => {
    const getFn = source.slice(source.indexOf("export async function GET"));
    expect(getFn).toContain("return POST(request);");
  });

  it("declares a Node.js runtime and an explicit maxDuration for the Hobby-plan execution ceiling", () => {
    expect(source).toContain('export const runtime = "nodejs";');
    expect(source).toContain("export const maxDuration = 60;");
  });
});
