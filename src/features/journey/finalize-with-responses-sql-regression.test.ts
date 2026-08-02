import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0037_finalize_daily_log_with_responses.sql"),
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

describe("Migration 0037 - finalize_daily_log_with_responses", () => {
  const migration = readMigration();
  const body = sliceFunction(
    migration,
    "create or replace function public.finalize_daily_log_with_responses",
    "revoke all on function public.finalize_daily_log_with_responses",
  );

  it("requires a real session before touching anything", () => {
    expect(body).toContain("if actor_id is null then");
    expect(body).toContain("using errcode = '42501';");
  });

  it("re-derives ownership from the session, never trusts a client-supplied user id", () => {
    expect(body).toContain("and ce.user_id = actor_id");
  });

  it("is idempotent - an already-finalized day returns early without touching habit_logs/point_events/achievements again", () => {
    const idempotentBranch = body.split("if daily_record.status = 'finalized' then")[1]?.split("end if;")[0];
    expect(idempotentBranch).toBeDefined();
    expect(idempotentBranch).toContain("'already_finalized', true");
    expect(idempotentBranch).not.toContain("insert into public.habit_logs");
    expect(idempotentBranch).not.toContain("insert into public.point_events");
  });

  it("removed the required-habits blocking gate entirely - no variable declaration or runtime check remains (only an explanatory comment referencing the old name)", () => {
    expect(body).not.toContain("missing_required_habits integer");
    expect(body).not.toContain("if missing_required_habits > 0 then");
    expect(body).not.toContain("Habitos obrigatorios pendentes");
  });

  it("upserts every habit applicable to the day from server truth (challenge_day_habits), not from the client's list", () => {
    expect(body).toContain("from public.challenge_day_habits cdh");
    expect(body).toContain("join public.habits h on h.id = cdh.habit_id");
    expect(body).toContain("left join input_responses ir on ir.habit_id = h.id");
  });

  it("normalizes an unanswered or unrecognized status to pending, never raises for it", () => {
    expect(body).toContain("else 'pending'::public.habit_log_status");
  });

  it("silently coerces not_applicable back to pending for a required habit instead of raising", () => {
    expect(body).toContain(
      "when ir.raw_status = 'not_applicable' and not cdh.required then 'not_applicable'::public.habit_log_status",
    );
  });

  it("caps and validates the responses payload before processing it", () => {
    expect(body).toContain("jsonb_typeof(coalesce(responses, '[]'::jsonb)) is distinct from 'array'");
    expect(body).toContain("responses_count > 200");
  });

  it("drops a malformed habit_id via a uuid-shape regex instead of letting a bad cast crash the whole finalize", () => {
    expect(body).toContain(
      "where elem ->> 'habit_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'",
    );
  });

  it("computes value_json server-side by habit_type, never trusts a client-supplied value", () => {
    expect(body).not.toContain("target_value_json");
    expect(body).toContain("jsonb_build_object('value', 1)");
    expect(body).toContain("jsonb_build_object('completed', true)");
  });

  it("caps comment length the same way update_habit_log always has", () => {
    expect(body).toContain("nullif(left(coalesce(elem ->> 'note', ''), 1200), '')");
  });

  it("keeps the exact points/streak/achievement/analytics logic unchanged from finalize_daily_log (0036)", () => {
    expect(body).toContain("all_habits_bonus_points");
    expect(body).toContain("streak_minimum_completion");
    expect(body).toContain("'tres-dias-seguidos' and streak_count >= 3");
    expect(body).toContain("'challenge_day_completed'");
    expect(body).toContain("'challenge_completed'");
  });

  it("reads streak_minimum_completion from the same configurable rule finalize_daily_log always has, not a new hardcoded value", () => {
    expect(body).toContain("streak_minimum_completion := public.journey_rule_int(");
  });

  it("returns a habit-by-habit result array for the client-side summary", () => {
    expect(body).toContain("'habit_results', habit_results");
  });

  it("revokes public/anon execute and grants only to authenticated", () => {
    expect(migration).toContain(
      "revoke all on function public.finalize_daily_log_with_responses(uuid, jsonb) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.finalize_daily_log_with_responses(uuid, jsonb) to authenticated;",
    );
  });

  it("does not modify or drop the pre-existing update_habit_log/finalize_daily_log functions", () => {
    expect(migration).not.toContain("drop function if exists public.update_habit_log");
    expect(migration).not.toContain("drop function if exists public.finalize_daily_log(uuid)");
  });
});
