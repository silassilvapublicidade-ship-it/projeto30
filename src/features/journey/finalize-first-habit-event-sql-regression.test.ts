import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0038_fix_first_habit_event_in_batch_finalize.sql"),
    "utf8",
  );
}

function sliceFunction(source: string, name: string, nextMarker: string) {
  const start = source.indexOf(name);
  expect(start, `expected to find "${name}"`).toBeGreaterThan(-1);
  const end = source.indexOf(nextMarker, start);
  expect(end, `expected to find "${nextMarker}" after "${name}"`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/**
 * Regression coverage for a real gap found while validating 0037 against a
 * live QA fixture (never the 3 real participants): challenge_first_habit_completed
 * used to fire from update_habit_log() on the member's first-ever completed
 * habit. The batched finalize flow upserts habit_logs directly and never
 * calls update_habit_log, so the event silently stopped firing - confirmed
 * by finalizing a real day and finding only challenge_day_completed in
 * analytics_events. admin_challenge_funnel's "first_habit" stage depends on
 * this event, so this was a real regression, not cosmetic.
 */
describe("Migration 0038 - challenge_first_habit_completed restored in batch finalize", () => {
  const migration = readMigration();
  const body = sliceFunction(
    migration,
    "create or replace function public.finalize_daily_log_with_responses",
    "$$;",
  );

  it("fires the event using the exact same completed_habits_lifetime = 1 condition update_habit_log used", () => {
    const trigger = body.split("select count(*)\n  into completed_habits_lifetime")[1]?.slice(0, 800);
    expect(trigger).toBeDefined();
    expect(trigger).toContain("if completed_habits_lifetime = 1 then");
    expect(trigger).toContain("'challenge_first_habit_completed'");
  });

  it("fires strictly after completed_habits_lifetime is computed, before it's used for achievement checks", () => {
    const lifetimeIndex = body.indexOf("into completed_habits_lifetime");
    const eventIndex = body.indexOf("'challenge_first_habit_completed'");
    const achievementLoopIndex = body.indexOf("for achievement_record in");
    expect(lifetimeIndex).toBeGreaterThan(-1);
    expect(eventIndex).toBeGreaterThan(lifetimeIndex);
    expect(achievementLoopIndex).toBeGreaterThan(eventIndex);
  });

  it("does not touch the idempotent early-return path, the habit upsert loop, or any points/streak/achievement formula", () => {
    expect(body).toContain("if daily_record.status = 'finalized' then");
    expect(body).toContain("on conflict (daily_log_id, habit_id) do update");
    expect(body).toContain("all_habits_bonus_points");
    expect(body).toContain("'tres-dias-seguidos' and streak_count >= 3");
  });

  it("keeps the function's signature unchanged (create or replace, no drop, no new grants needed)", () => {
    expect(migration).toContain(
      "create or replace function public.finalize_daily_log_with_responses(\n  target_daily_log_id uuid,\n  responses jsonb default '[]'::jsonb\n)",
    );
    expect(migration).not.toContain("drop function");
    expect(migration).not.toContain("revoke");
    expect(migration).not.toContain("grant execute");
  });
});
