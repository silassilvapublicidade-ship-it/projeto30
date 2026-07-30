import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0016_analytics_events_instrumentation.sql"),
    "utf8",
  );
}

describe("analytics events instrumentation SQL migration", () => {
  const migration = readMigration();

  it("redefines exactly the four funnel-relevant RPCs, nothing else", () => {
    expect(migration).toContain("create or replace function public.join_available_challenge()");
    expect(migration).toContain("create or replace function public.join_specific_challenge(");
    expect(migration).toContain("create or replace function public.update_habit_log(");
    expect(migration).toContain("create or replace function public.finalize_daily_log(");
    expect(migration).not.toContain("create table");
    expect(migration).not.toContain("create unique index");
    expect(migration).not.toContain("drop index");
  });

  it("preserves join_available_challenge's deterministic order fix from 0013", () => {
    expect(migration).toContain("order by c.start_date asc nulls last, c.created_at asc, c.id asc");
  });

  it("only records challenge_joined on the genuinely-new-enrollment path, never the idempotent/race paths", () => {
    const joinSpecific = migration.split("function public.join_specific_challenge(")[1]?.split("$$;")[0];
    expect(joinSpecific).toBeDefined();
    expect(joinSpecific).toContain("if created_enrollment_id is not null then");
    expect(joinSpecific).toContain("'challenge_joined'");
    // The race-recovery branch (existing_enrollment_id lookup after a
    // conflict) must not also emit the event - it appears once per function.
    expect(joinSpecific?.match(/'challenge_joined'/g)?.length).toBe(1);
  });

  it("adds challenge_first_habit_completed only when the completed count is exactly 1", () => {
    expect(migration).toContain("completed_habits_lifetime = 1");
    expect(migration).toContain("'challenge_first_habit_completed'");
  });

  it("adds day/day-7/halfway/completed events to finalize_daily_log without touching scoring logic", () => {
    expect(migration).toContain("'challenge_day_completed'");
    expect(migration).toContain("finalized_days >= 7");
    expect(migration).toContain("'challenge_day_7_reached'");
    expect(migration).toContain("halfway_target := ceil(daily_record.duration_days::numeric / 2)");
    expect(migration).toContain("'challenge_halfway_reached'");
    expect(migration).toContain("if completed_cycle then");
    expect(migration).toContain("'challenge_completed'");
  });

  it("never emits any event on the already-finalized early-return path", () => {
    const finalizeBody = migration.split("function public.finalize_daily_log(")[1];
    expect(finalizeBody).toBeDefined();
    const beforeAlreadyFinalizedReturn = finalizeBody?.split("'already_finalized', true")[0];
    expect(beforeAlreadyFinalizedReturn).not.toContain("record_analytics_event");
  });

  it("never touches point calculation, streak formula or achievement unlock rules", () => {
    expect(migration).toContain("insert into public.point_events");
    expect(migration).toContain("streak_current = streak_count");
    expect(migration).toContain("'primeiro-habito'");
  });

  it("uses perform (not select) so the event's return value is intentionally discarded", () => {
    expect(migration).toMatch(/perform public\.record_analytics_event\(/);
  });
});
