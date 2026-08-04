import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "services", "admin-operational-overview.service.ts"), "utf8");
}

describe("getAdminOperationalOverview / getAdminRecentActivity", () => {
  const source = readSource();

  it("both use the request-scoped server client (permission enforced inside the RPCs via auth.uid())", () => {
    for (const fnName of ["getAdminOperationalOverview", "getAdminRecentActivity"]) {
      const start = source.indexOf(`export async function ${fnName}`);
      expect(start, `${fnName} should exist`).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf("\n}\n", start));
      expect(body).toContain("createSupabaseServerClient()");
    }
  });

  it("calls the single aggregated RPC for the overview - one round trip, not one query per card", () => {
    expect(source).toContain('supabase.rpc("admin_operational_overview", { p_period: period })');
  });

  it("calls a separate, dedicated RPC for recent activity (Parte K's suggested split)", () => {
    expect(source).toContain('supabase.rpc("admin_recent_activity", { p_limit: limit })');
  });

  it("normalizes criticalErrors/warnings to numbers exactly once, never scattering Number(...) across the UI", () => {
    const start = source.indexOf("export async function getAdminOperationalOverview");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain("criticalErrors: Number(raw.metrics.criticalErrors ?? 0)");
    expect(body).toContain("warnings: Number(raw.metrics.warnings ?? 0)");
  });
});
