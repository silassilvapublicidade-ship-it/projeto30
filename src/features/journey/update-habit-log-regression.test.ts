import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

function sliceFunction(source: string, name: string, nextMarker: string) {
  const start = source.indexOf(name);
  expect(start, `expected to find "${name}"`).toBeGreaterThan(-1);
  const end = source.indexOf(nextMarker, start);
  expect(end, `expected to find "${nextMarker}" after "${name}"`).toBeGreaterThan(start);
  return source.slice(start, end);
}

/**
 * Regression coverage for a real production incident: every "Marcar como
 * realizado" click failed with "Acao nao salva" (23502 not-null violation)
 * from the moment 0030_challenge_lifecycle_rpcs.sql shipped, because its
 * rewrite of update_habit_log() dropped challenge_day_id from the INSERT
 * into habit_logs (not null, no default) along with several validations.
 * Found by reproducing the exact call against the linked database inside a
 * rolled-back transaction (impersonating the real signed-in user via
 * request.jwt.claims), not by guessing. Fixed in
 * 0034_fix_update_habit_log_regression.sql. This test pins the fix's
 * shape so a future rewrite of this function can't silently drop the same
 * column (or the other restored validations) again - 0030 shipped with a
 * test that only checked the NEW behavior it added (challenge_status), not
 * that the pre-existing behavior it was supposed to preserve stayed intact,
 * which is exactly how this slipped through undetected.
 */
describe("Migration 0034 - update_habit_log regression fix", () => {
  const migration = readSource(
    "supabase",
    "migrations",
    "0034_fix_update_habit_log_regression.sql",
  );
  const body = sliceFunction(
    migration,
    "create or replace function public.update_habit_log",
    "comment on function public.update_habit_log",
  );

  it("inserts challenge_day_id into habit_logs (the actual root cause - not null, no default)", () => {
    expect(body).toMatch(/insert into public\.habit_logs \(\s*daily_log_id,\s*challenge_day_id,/);
    expect(body).toContain("daily_record.challenge_day_id,");
  });

  it("keeps 0030's challenge_status guard (the legitimate addition, not touched by this fix)", () => {
    expect(body).toContain("c.status as challenge_status");
    expect(body).toContain("daily_record.challenge_status <> 'active'::public.challenge_status");
  });

  it("restores the habit_type allow-list validation dropped by 0030", () => {
    expect(body).toContain("habit_record.habit_type not in (");
    expect(body).toContain("'boolean'::public.habit_type");
    expect(body).toContain("'duration'::public.habit_type");
    expect(body).toContain("'quantity'::public.habit_type");
    expect(body).toContain("'reading'::public.habit_type");
  });

  it("restores the target_status allow-list validation dropped by 0030", () => {
    expect(body).toContain("target_status is null or target_status not in (");
  });

  it("restores the not_applicable-on-a-required-habit guard dropped by 0030", () => {
    expect(body).toContain("target_status = 'not_applicable'::public.habit_log_status");
    expect(body).toContain("and habit_record.required then");
  });

  it("restores numeric value_json validation/normalization for quantity/duration habits", () => {
    expect(body).toContain("jsonb_typeof(normalized_value -> 'value') <> 'number'");
    expect(body).toContain("Valor numerico necessario para concluir este habito.");
    expect(body).toContain("(normalized_value ->> 'value')::numeric < 0");
  });

  it("restores boolean/reading value_json normalization and completed_at population", () => {
    expect(body).toContain("jsonb_build_object('completed', true)");
    expect(body).toContain("case when target_status = 'completed' then now() else null end");
  });

  it("restores the challenge_first_habit_completed milestone event and the full return payload", () => {
    expect(body).toContain("completed_habits_lifetime = 1");
    expect(body).toContain("'challenge_first_habit_completed'");
    expect(body).toContain("'habit_log_id', saved_habit_log_id");
    expect(body).toContain("'status', target_status");
  });

  it("never touches the points formula, streak formula or completion_percent calculation", () => {
    expect(migration).not.toContain("streak_current");
    expect(migration).not.toContain("insert into public.point_events");
    expect(migration).not.toContain("create or replace function public.journey_recalculate_daily_log");
  });
});

/**
 * Second bug found while validating the first fix in production: undo+redo
 * of a habit completion re-triggers the "first habit completed" condition
 * for an enrollment that already has that milestone recorded, and
 * record_analytics_event() had no ON CONFLICT clause to make that
 * idempotent - the resulting 23505 aborted the whole update_habit_log call
 * (including the legitimate habit_logs write), a second path to the same
 * "Acao nao salva" symptom. Fixed in 0035_fix_analytics_milestone_reentry.sql.
 */
describe("Migration 0035 - record_analytics_event milestone idempotency fix", () => {
  const migration = readSource(
    "supabase",
    "migrations",
    "0035_fix_analytics_milestone_reentry.sql",
  );
  const body = sliceFunction(
    migration,
    "create or replace function public.record_analytics_event",
    "revoke all on function public.record_analytics_event",
  );

  it("adds an ON CONFLICT clause matching the exact partial unique index predicate", () => {
    expect(body).toMatch(/on conflict \(enrollment_id, event_name\)\s*where enrollment_id is not null/);
    expect(body).toContain("do nothing");
  });

  it("the ON CONFLICT event list matches analytics_events_enrollment_milestone_unique's predicate exactly (0015)", () => {
    const indexMigration = readSource("supabase", "migrations", "0015_analytics_events.sql");
    const indexPredicate = sliceFunction(
      indexMigration,
      "create unique index if not exists analytics_events_enrollment_milestone_unique",
      ");",
    );

    for (const eventName of [
      "challenge_joined",
      "challenge_first_habit_completed",
      "challenge_day_7_reached",
      "challenge_halfway_reached",
      "challenge_completed",
      "challenge_abandoned",
    ]) {
      expect(indexPredicate).toContain(`'${eventName}'`);
      expect(body).toContain(`'${eventName}'`);
    }
  });

  it("still validates event_name/source/metadata exactly as before - no relaxed input validation", () => {
    expect(body).toContain("Nome de evento nao permitido.");
    expect(body).toContain("Origem de evento invalida.");
    expect(body).toContain("Metadata de evento precisa ser um objeto JSON.");
  });

  it("re-applies revoke/grant for the unchanged 7-arg signature", () => {
    expect(migration).toMatch(
      /revoke all on function public\.record_analytics_event\(text, uuid, uuid, jsonb, text, text, uuid\)\s*from public, anon;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.record_analytics_event\(text, uuid, uuid, jsonb, text, text, uuid\)\s*to authenticated;/,
    );
  });
});

describe("journey.actions.ts - RPC failures are now logged server-side", () => {
  const source = readSource("src", "features", "member", "journey.actions.ts");

  it("defines a shared logger that never leaks anything beyond the Postgres error code/message", () => {
    expect(source).toContain("function logJourneyRpcFailure(");
    expect(source).toContain("console.error(");
  });

  it("logs before redirecting on the save_journal_entry failure path", () => {
    expect(source).toContain('logJourneyRpcFailure("save_journal_entry", error)');
  });

  it("logs the finalize_daily_log_with_responses failure path too (batched finalize replaced the old per-habit/finalize actions)", () => {
    expect(source).toContain('logJourneyRpcFailure(\n      "finalize_daily_log_with_responses",');
  });
});
