import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0010_multi_challenge_enrollments.sql"),
    "utf8",
  );
}

describe("multi challenge enrollments SQL migration", () => {
  const migration = readMigration();

  it("drops only the global one-active-per-user index, not the per-challenge one", () => {
    expect(migration).toContain(
      "drop index if exists public.challenge_enrollments_one_active_per_user;",
    );
    // The per-(user,challenge) index from 0001 is a different name and must
    // never be dropped by this migration.
    expect(migration).not.toContain(
      "drop index if exists public.challenge_enrollments_one_active_per_user_challenge",
    );
  });

  it("never deletes enrollment or journey history", () => {
    expect(migration).not.toContain("delete from public.challenge_enrollments");
    expect(migration).not.toContain("delete from public.daily_logs");
    expect(migration).not.toContain("delete from public.habit_logs");
    expect(migration).not.toContain("delete from public.point_events");
    expect(migration).not.toContain("delete from public.user_achievements");
  });

  it("never touches challenge_day_habits, points, streak or finalization", () => {
    expect(migration).not.toContain("alter table public.challenge_day_habits");
    expect(migration).not.toContain(
      "create or replace function public.finalize_daily_log",
    );
    expect(migration).not.toContain(
      "create or replace function public.journey_recalculate_daily_log",
    );
    expect(migration).not.toContain("set streak_current");
  });

  it("join_available_challenge no longer returns any existing enrollment regardless of challenge", () => {
    expect(migration).toContain("create or replace function public.join_available_challenge()");
    // The old behavior selected any active/paused enrollment before picking
    // a challenge. The new version only skips challenges the user is
    // already enrolled in, via a not-exists scoped to challenge_id.
    expect(migration).toMatch(
      /not exists\s*\(\s*select 1\s*from public\.challenge_enrollments ce\s*where ce\.user_id = actor_id\s*and ce\.challenge_id = c\.id\s*and ce\.status in \('active', 'paused'\)\s*\)/,
    );
  });

  it("join_specific_challenge no longer blocks joining a different challenge", () => {
    expect(migration).toContain("create or replace function public.join_specific_challenge(");
    expect(migration).not.toContain("Voce ja esta participando de outro desafio ativo");
    expect(migration).not.toContain("errcode = 'P0004'");
  });

  it("join_specific_challenge stays idempotent for the same challenge and still validates availability", () => {
    expect(migration).toMatch(
      /ce\.challenge_id = target_challenge_id\s*and ce\.status in \('active', 'paused'\)/,
    );
    expect(migration).toContain("Ja inscrito neste mesmo desafio: idempotente, apenas devolve.");
    expect(migration).toContain("c.status = 'active'");
    expect(migration).toContain("errcode = 'P0002'");
  });

  it("keeps join_specific_challenge security definer with execute revoked from public roles", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "revoke execute on function public.join_specific_challenge(uuid)\n  from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.join_specific_challenge(uuid)\n  to authenticated;",
    );
  });
});
