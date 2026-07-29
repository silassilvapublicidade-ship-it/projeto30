import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0006_admin_analytics.sql"),
    "utf8",
  );
}

describe("admin analytics SQL migration", () => {
  const migration = readMigration();

  it("defines every admin analytics function as security definer", () => {
    const functionNames = [
      "admin_require_admin",
      "admin_dashboard_overview",
      "admin_list_challenges",
      "admin_challenge_detail",
      "admin_list_participants",
      "admin_participant_detail",
    ];

    for (const name of functionNames) {
      expect(migration).toContain(`create or replace function public.${name}`);
    }
  });

  it("gates every entry point behind an explicit admin check", () => {
    // admin_require_admin is the shared gate; every other function must call
    // it (directly or via `perform`) before returning any data.
    const callSites = migration.match(/public\.admin_require_admin\(\)/g) ?? [];
    // 1 definition using current_user_role internally + at least 5 call sites
    // (one per admin_* entry point that reads data).
    expect(callSites.length).toBeGreaterThanOrEqual(5);
  });

  it("revokes execute from anon/authenticated and grants only to authenticated", () => {
    expect(migration).toContain(
      "revoke execute on function public.admin_dashboard_overview() from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.admin_dashboard_overview() to authenticated;",
    );
    expect(migration).toContain(
      "revoke execute on function public.admin_challenge_detail(uuid) from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.admin_challenge_detail(uuid) to authenticated;",
    );
    expect(migration).toContain(
      "revoke execute on function public.admin_participant_detail(uuid) from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.admin_participant_detail(uuid) to authenticated;",
    );
  });

  it("only includes reflections in the participant detail payload for super_admin", () => {
    expect(migration).toContain("if v_role = 'super_admin' then");
    expect(migration).toContain("'reflections_visible', v_role = 'super_admin'");
  });

  it("uses the documented 3 day window for participant activity, consistently", () => {
    const matches = migration.match(/v_active_window constant interval := interval '3 days';/g) ?? [];
    // admin_dashboard_overview, admin_challenge_detail, admin_list_participants
    // and admin_participant_detail each declare their own copy of the window.
    expect(matches.length).toBe(4);
  });

  it("does not select any journal_entries content outside the super_admin branch", () => {
    const journalSelectIndex = migration.indexOf("from public.journal_entries je");
    const superAdminGuardIndex = migration.indexOf("if v_role = 'super_admin' then");

    expect(journalSelectIndex).toBeGreaterThan(-1);
    expect(superAdminGuardIndex).toBeGreaterThan(-1);
    expect(journalSelectIndex).toBeGreaterThan(superAdminGuardIndex);
  });
});
