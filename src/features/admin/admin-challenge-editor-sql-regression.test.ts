import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0017_admin_challenge_editor_and_funnel.sql"),
    "utf8",
  );
}

describe("admin challenge editor + funnel SQL migration", () => {
  const migration = readMigration();

  it("creates admin_generate_challenge_days as a single security-definer transaction", () => {
    expect(migration).toContain("create or replace function public.admin_generate_challenge_days");
    expect(migration).toContain("security definer");
  });

  it("only allows day generation while the challenge is a draft", () => {
    const fn = migration.split("function public.admin_generate_challenge_days")[1]?.split("$$;")[0];
    expect(fn).toContain("v_challenge.status <> 'draft'::public.challenge_status");
  });

  it("is idempotent: uses on conflict do nothing for both days and day-habit links", () => {
    const fn = migration.split("function public.admin_generate_challenge_days")[1]?.split("$$;")[0];
    expect(fn).toContain("on conflict (challenge_id, day_number) do nothing");
    expect(fn).toContain("on conflict (challenge_day_id, habit_id) do nothing");
  });

  it("gates day generation behind admin_require_admin(), matching the existing admin RPC convention", () => {
    const fn = migration.split("function public.admin_generate_challenge_days")[1]?.split("$$;")[0];
    expect(fn).toContain("perform public.admin_require_admin();");
  });

  it("creates admin_challenge_funnel reading from analytics_events, admin-gated, stable", () => {
    expect(migration).toContain("create or replace function public.admin_challenge_funnel");
    expect(migration).toContain("from public.analytics_events");
    expect(migration).toContain("perform public.admin_require_admin();");
    expect(migration).toContain("stable");
  });

  it("funnel covers detail views, click, join, first habit, day 7, halfway, completed and abandoned", () => {
    const fn = migration.split("function public.admin_challenge_funnel")[1]?.split("$$;")[0];
    for (const eventName of [
      "challenge_detail_viewed",
      "challenge_join_clicked",
      "challenge_joined",
      "challenge_first_habit_completed",
      "challenge_day_7_reached",
      "challenge_halfway_reached",
      "challenge_completed",
      "challenge_abandoned",
    ]) {
      expect(fn).toContain(`'${eventName}'`);
    }
  });

  it("grants execute only to authenticated on both new functions, revoking public/anon", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.admin_generate_challenge_days\(uuid\)\s*\n\s*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.admin_challenge_funnel\(uuid\)\s*\n\s*from public, anon, authenticated/,
    );
  });

  it("does not create any parallel challenge-structure table", () => {
    expect(migration).not.toContain("create table");
  });
});
