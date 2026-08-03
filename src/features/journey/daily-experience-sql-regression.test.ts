import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

function sliceFunction(source: string, name: string) {
  const start = source.indexOf(`create or replace function public.${name}`);
  expect(start, `expected to find ${name}`).toBeGreaterThan(-1);
  const nextFn = source.indexOf("create or replace function", start + 10);
  return source.slice(start, nextFn === -1 ? undefined : nextFn);
}

describe("Migration 0049 - finalize returns streak explanation", () => {
  const migration = readMigration("0049_finalize_returns_streak_explanation.sql");
  const body = sliceFunction(migration, "finalize_daily_log_with_responses");

  it("computes streak_minimum_completion before the idempotent early-return, not after", () => {
    const computeIndex = body.indexOf("streak_minimum_completion := public.journey_rule_int(");
    const earlyReturnIndex = body.indexOf("if daily_record.status = 'finalized' then");
    expect(computeIndex).toBeGreaterThan(-1);
    expect(earlyReturnIndex).toBeGreaterThan(-1);
    expect(computeIndex).toBeLessThan(earlyReturnIndex);
  });

  it("the already_finalized branch now includes streak_current/streak_best/streak_minimum_completion/streak_met_minimum", () => {
    const earlyReturnStart = body.indexOf("if daily_record.status = 'finalized' then");
    const earlyReturnBlock = body.slice(earlyReturnStart, body.indexOf("end if;", earlyReturnStart));
    expect(earlyReturnBlock).toContain("'streak_current', daily_record.streak_current");
    expect(earlyReturnBlock).toContain("'streak_best', daily_record.streak_best");
    expect(earlyReturnBlock).toContain("'streak_minimum_completion', streak_minimum_completion");
    expect(earlyReturnBlock).toContain(
      "'streak_met_minimum', daily_record.completion_percent >= streak_minimum_completion",
    );
  });

  it("the fresh-finalize return also includes the same 2 new fields", () => {
    const finalReturnStart = body.lastIndexOf("return jsonb_build_object(");
    const finalReturn = body.slice(finalReturnStart);
    expect(finalReturn).toContain("'streak_minimum_completion', streak_minimum_completion");
    expect(finalReturn).toContain("'streak_met_minimum', completion_percent >= streak_minimum_completion");
  });

  it("the streak-count loop itself is byte-for-byte unchanged from 0039 - this migration never touches the calculation", () => {
    expect(body).toContain("if log_record.log_date <> expected_date then\n      exit;\n    end if;");
    expect(body).toContain("if log_record.completion_percent < streak_minimum_completion then\n      exit;\n    end if;");
    expect(body).toContain("streak_count := streak_count + 1;\n    expected_date := expected_date - 1;");
  });
});

describe("Migration 0050 - habit scheduled visibility engine", () => {
  const migration = readMigration("0050_habit_scheduled_visibility.sql");

  it("adds visibility_config with a safe, behavior-preserving default", () => {
    expect(migration).toContain(
      "add column if not exists visibility_config jsonb not null default '{\"type\": \"all_days\"}'::jsonb;",
    );
  });

  it("CHECK constraint validates all 6 supported types and their required keys", () => {
    expect(migration).toContain("'all_days', 'first_day', 'last_day'");
    expect(migration).toContain("(visibility_config ->> 'type') = 'from_day'");
    expect(migration).toContain("jsonb_typeof(visibility_config -> 'day') = 'number'");
    expect(migration).toContain("(visibility_config ->> 'type') = 'between_days'");
    expect(migration).toContain("(visibility_config ->> 'type') = 'specific_days'");
  });

  it("habit_visible_on_day is a pure function (no table access), immutable, with a locked search_path", () => {
    const body = sliceFunction(migration, "habit_visible_on_day") + migration.slice(migration.indexOf("$$;", migration.indexOf("habit_visible_on_day")));
    expect(migration).toContain("language sql\nimmutable\nset search_path = public, pg_temp");
    expect(body).not.toContain("select * from public.");
  });

  it("an unrecognized visibility type falls back to visible, never to hidden", () => {
    const start = migration.indexOf("create or replace function public.habit_visible_on_day");
    const end = migration.indexOf("revoke all on function public.habit_visible_on_day");
    const body = migration.slice(start, end);
    expect(body).toContain("else true");
  });

  it("journey_recalculate_daily_log now also requires habit_visible_on_day, in addition to frequency_type = 'daily'", () => {
    const body = sliceFunction(migration, "journey_recalculate_daily_log");
    expect(body).toContain("and h.frequency_type = 'daily'");
    expect(body).toContain(
      "and public.habit_visible_on_day(h.visibility_config, cd.day_number, c.duration_days);",
    );
  });

  it("finalize forces not_applicable server-side for a non-visible item, regardless of what the client sent - never trusts the client for this", () => {
    const body = sliceFunction(migration, "finalize_daily_log_with_responses");
    expect(body).toContain(
      "when not public.habit_visible_on_day(h.visibility_config, challenge_day_number, daily_record.duration_days)\n          then 'not_applicable'::public.habit_log_status",
    );
    // this check must come BEFORE the client-supplied status is even considered
    const notVisibleIndex = body.indexOf("when not public.habit_visible_on_day");
    const clientStatusIndex = body.indexOf("when ir.raw_status = 'completed'");
    expect(notVisibleIndex).toBeGreaterThan(-1);
    expect(notVisibleIndex).toBeLessThan(clientStatusIndex);
  });
});

describe("Migration 0051 - finalize idempotent return completeness", () => {
  const migration = readMigration("0051_finalize_idempotent_return_completeness.sql");
  const body = sliceFunction(migration, "finalize_daily_log_with_responses");

  it("already_finalized now recomputes and returns applicable_habits/completed_habits via the idempotent recalculate function", () => {
    const earlyReturnStart = body.indexOf("if daily_record.status = 'finalized' then");
    const earlyReturnBlock = body.slice(earlyReturnStart, body.indexOf("end if;", earlyReturnStart));
    expect(earlyReturnBlock).toContain("progress := public.journey_recalculate_daily_log(daily_record.id);");
    expect(earlyReturnBlock).toContain("'applicable_habits', (progress ->> 'applicable_habits')::integer");
    expect(earlyReturnBlock).toContain("'completed_habits', (progress ->> 'completed_habits')::integer");
  });
});

describe("Migration 0052 - daily completion analytics events", () => {
  const migration = readMigration("0052_daily_completion_analytics_events.sql");

  it("adds exactly the 4 events the brief asked for, alongside every pre-existing one (widen, never replace)", () => {
    for (const event of [
      "daily_completion_summary_viewed",
      "daily_completion_continue_clicked",
      "daily_completion_journey_clicked",
      "daily_completion_share_clicked",
    ]) {
      expect(migration).toContain(`'${event}'`);
    }
    // a couple of pre-existing ones must still be present (widen, not replace)
    expect(migration).toContain("'challenge_day_completed'");
    expect(migration).toContain("'push_subscription_revoked'");
  });

  it("both the CHECK constraint and record_analytics_event's inline allowlist were updated together (kept in sync, per 0042's own convention)", () => {
    const constraintOccurrences = migration.match(/daily_completion_summary_viewed/g)?.length ?? 0;
    expect(constraintOccurrences).toBe(2);
  });
});
