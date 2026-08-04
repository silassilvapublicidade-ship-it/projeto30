import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0071_daily_reminder_uses_chosen_time.sql"),
    "utf8",
  );
}

describe("Migration 0071 - automation_resolve_daily_reminder_audience now uses reminder_time (Correções obrigatórias pré-lançamento, Parte B)", () => {
  const migration = readMigration();

  it("replaces the exact same function signature - never a parallel/orphaned overload", () => {
    expect(migration).toContain(
      "create or replace function public.automation_resolve_daily_reminder_audience()",
    );
    expect(migration).toContain("returns table (local_date date, push_eligible boolean, user_id uuid)");
  });

  it("reads the user's own local time, not just the local date, from the same timezone fallback pattern used everywhere else", () => {
    expect(migration).toContain(
      "(timezone(coalesce(nullif(u.timezone, ''), 'America/Sao_Paulo'), now()))::time as local_time",
    );
  });

  it("only becomes eligible once local time has reached the user's chosen reminder_time - never before", () => {
    expect(migration).toContain("(up.reminder_time is null or loc.local_time >= up.reminder_time)");
  });

  it("keeps the daily_reminder_enabled gate and the 7-21h sanity window - never removes existing safety checks", () => {
    expect(migration).toContain("coalesce((up.notifications ->> 'daily_reminder_enabled')::boolean, false)");
    expect(migration).toContain("extract(hour from loc.local_time) between 7 and 21");
  });

  it("still excludes users who already finalized today - never re-nags after completion", () => {
    expect(migration).toContain("dl.status = 'finalized'");
  });

  it("keeps execute privileges restricted to service_role only, same as every other automation resolver", () => {
    expect(migration).toContain(
      "revoke all on function public.automation_resolve_daily_reminder_audience() from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.automation_resolve_daily_reminder_audience() to service_role;",
    );
  });
});
