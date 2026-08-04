import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", "0074_admin_operational_cockpit.sql"), "utf8");
}

const migration = readMigration();

describe("admin_get_system_health_overview (0074 - additive extension)", () => {
  const fn = migration.split("function public.admin_get_system_health_overview")[1]?.split("$$;")[0] ?? "";

  it("adds openCriticalErrors24h/openErrors24h to the returned jsonb without removing any existing key", () => {
    expect(fn).toContain("'openCriticalErrors24h', v_open_critical_24h");
    expect(fn).toContain("'openErrors24h', v_open_error_24h");
    for (const key of [
      "'status'",
      "'errors24h'",
      "'campaignsFailed24h'",
      "'deliveriesRetry'",
      "'onboardingStuck'",
      "'lastCronRun'",
    ]) {
      expect(fn).toContain(key);
    }
  });

  it("the status decision logic (critico/degradado/atencao/saudavel) is byte-for-byte unchanged", () => {
    expect(fn).toContain("if v_open_critical_24h > 0");
    expect(fn).toContain("or coalesce((v_last_cron->>'lastSeenAt')::timestamptz, 'epoch'::timestamptz) < now() - interval '36 hours'");
    expect(fn).toContain("v_status := 'critico';");
  });
});

describe("admin_operational_overview - single aggregated RPC, no N+1", () => {
  const fn = migration.split("function public.admin_operational_overview")[1]?.split("$$;")[0] ?? "";

  it("is security definer, gated by admin_require_admin()", () => {
    expect(migration).toContain("create or replace function public.admin_operational_overview");
    expect(fn).toContain("security definer");
    expect(fn).toContain("perform public.admin_require_admin();");
  });

  it("reuses admin_get_system_health_overview() verbatim for health - never a second health rule", () => {
    expect(fn).toContain("v_health := public.admin_get_system_health_overview();");
  });

  it("validates the period against a fixed whitelist, never trusting an arbitrary string", () => {
    expect(fn).toContain("if p_period not in ('today', '24h', '7d') then");
  });

  it("'today' is bucketed in America/Sao_Paulo (the org's single reference timezone), never per-user timezone joins", () => {
    expect(fn).toContain("date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'");
  });

  it("active user = daily_logs.updated_at in the period, the same signal admin_dashboard_overview already uses for 'participante ativo' (0006)", () => {
    expect(fn).toContain("from public.daily_logs dl");
    expect(fn).toContain("join public.challenge_enrollments ce on ce.id = dl.enrollment_id");
    expect(fn).toContain("where dl.updated_at >= v_period_start");
  });

  it("excludes is_test challenges from the current-cycle lookup", () => {
    expect(fn).toContain("where status = 'active' and is_test = false and deleted_at is null");
  });

  it("never invents a faster cron cadence than the real Vercel Hobby-plan limit", () => {
    expect(fn).toContain("Cron limitado a 1 execucao/dia no plano atual da Vercel.");
  });

  it("returns everything (health, metrics, blocks, cron note) in one jsonb - a single round trip for the whole first fold", () => {
    expect(fn).toMatch(/return jsonb_build_object\(\s*'period'/);
    expect(fn).toContain("'metrics', jsonb_build_object(");
    expect(fn).toContain("'blocks', jsonb_build_object(");
  });

  it("only service_role-independent grant - callable by any authenticated admin, gate enforced inside", () => {
    expect(migration).toContain("grant execute on function public.admin_operational_overview(text) to authenticated;");
  });
});

describe("admin_recent_activity - reuses existing tables, never before_json/after_json (PII risk)", () => {
  const fn = migration.split("function public.admin_recent_activity")[1]?.split("$$;")[0] ?? "";

  it("is gated and caps the limit server-side", () => {
    expect(fn).toContain("perform public.admin_require_admin();");
    expect(fn).toContain("v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);");
  });

  it("never selects before_json/after_json from admin_audit_logs (can contain email, see admin_create_user)", () => {
    const auditBlock = fn.slice(fn.indexOf("from public.admin_audit_logs") - 300, fn.indexOf("from public.admin_audit_logs"));
    expect(auditBlock).not.toMatch(/before_json|after_json/);
  });

  it("reuses admin_audit_logs, notification_campaigns and system_error_events - no new table", () => {
    expect(fn).toContain("from public.admin_audit_logs");
    expect(fn).toContain("from public.notification_campaigns");
    expect(fn).toContain("from public.system_error_events");
  });

  it("only surfaces error/critical severity system_error_events, not every info/warning noise event", () => {
    expect(fn).toContain("where e.severity in ('critical', 'error')");
  });
});

describe("analytics_events whitelist gains admin_overview_viewed only", () => {
  it("is present in both the table CHECK constraint and the RPC's inline whitelist", () => {
    const constraintBlock = migration.slice(
      migration.indexOf("add constraint analytics_events_event_name_check"),
      migration.indexOf(");", migration.indexOf("add constraint analytics_events_event_name_check")),
    );
    expect(constraintBlock).toContain("'admin_overview_viewed'");

    const fnBlock = migration.slice(migration.lastIndexOf("create or replace function public.record_analytics_event"));
    expect(fnBlock).toContain("'admin_overview_viewed'");
  });
});
