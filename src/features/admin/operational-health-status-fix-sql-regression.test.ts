import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", "0075_operational_health_status_fix.sql"), "utf8");
}

const migration = readMigration();
const fn = migration.split("function public.admin_get_system_health_overview")[1]?.split("$$;")[0] ?? "";

describe("admin_get_system_health_overview (0075 - status rule fix)", () => {
  it("never treats missing telemetry alone as critical - critical requires real overdue work too", () => {
    expect(fn).toContain("or (v_overdue_scheduled_campaigns > 0 and not v_cron_has_recent_evidence)");
    expect(fn).not.toMatch(/v_last_cron is null[\s\S]{0,50}critico/);
  });

  it("computes a real, non-fabricated fallback signal from actual automation-dispatched campaigns", () => {
    expect(fn).toContain("select max(started_at) into v_last_automation_activity");
    expect(fn).toContain("from public.notification_campaigns");
    expect(fn).toContain("where source = 'automation' and started_at is not null");
  });

  it("counts real overdue scheduled campaigns as the objective 'pending work' signal", () => {
    expect(fn).toContain("select count(*) into v_overdue_scheduled_campaigns");
    expect(fn).toContain("where status = 'scheduled' and scheduled_for < now()");
  });

  it("cron evidence is the more recent of the two real signals (direct record or automation fallback)", () => {
    expect(fn).toContain("v_cron_evidence_at := greatest(");
    expect(fn).toContain("v_cron_has_recent_evidence := v_cron_evidence_at >= now() - interval '36 hours';");
  });

  it("atencao (not critico) is the outcome when there's no recent evidence but no pending work", () => {
    expect(fn).toContain("elsif v_errors_24h > 0 or v_onboarding_stuck >= 5 or not v_cron_has_recent_evidence");
    expect(fn).toMatch(/elsif v_errors_24h > 0[\s\S]{0,120}v_status := 'atencao';/);
  });

  it("degradado rule is untouched by this fix (still error-repeat or campaign-partial)", () => {
    expect(fn).toContain("elsif v_open_error_24h > 0 and (v_max_occurrence_24h >= 5 or v_campaigns_partial_24h > 0)");
  });

  it("exposes the 3 new fields additively in the returned jsonb, without dropping any existing key", () => {
    expect(fn).toContain("'overdueScheduledCampaigns', v_overdue_scheduled_campaigns");
    expect(fn).toContain("'lastAutomationActivityAt', v_last_automation_activity");
    expect(fn).toContain("'cronHasRecentEvidence', v_cron_has_recent_evidence");
    expect(fn).toContain("'lastCronRun', v_last_cron");
    expect(fn).toContain("'onboardingStuck', v_onboarding_stuck");
  });

  it("stays gated by admin_require_admin(), unchanged", () => {
    expect(fn).toContain("perform public.admin_require_admin();");
  });
});
