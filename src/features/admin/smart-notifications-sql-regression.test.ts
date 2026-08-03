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

describe("Migration 0053 - smart notifications schema", () => {
  const migration = readMigration("0053_smart_notifications_schema.sql");

  it("challenge_habit_notifications requires exactly the fields the brief named, with sane checks", () => {
    expect(migration).toContain("habit_id uuid not null references public.habits(id) on delete cascade");
    expect(migration).toContain("unique (habit_id)");
    expect(migration).toContain(
      "constraint challenge_habit_notifications_frequency_type_check check (\n    frequency_type in ('weekly', 'monthly')\n  )",
    );
    expect(migration).toContain(
      "constraint challenge_habit_notifications_monthly_day_check check (\n    (frequency_type <> 'monthly') or (monthly_day between 1 and 31)\n  )",
    );
    expect(migration).toContain(
      "constraint challenge_habit_notifications_priority_check check (\n    priority between 1 and 10\n  )",
    );
  });

  it("daily_motivation_messages category is constrained to exactly the 8 categories from the brief, including 'fe'", () => {
    for (const category of [
      "disciplina",
      "fe",
      "perseveranca",
      "constancia",
      "gratidao",
      "superacao",
      "proposito",
      "geral",
    ]) {
      expect(migration).toContain(`'${category}'`);
    }
  });

  it("daily_motivation_messages is admin-writable directly (RLS for all), matching its no-cross-table-validation design", () => {
    expect(migration).toContain('"Admins can manage daily motivation messages"');
    expect(migration).toContain("for all\n  to authenticated\n  using (public.is_admin())\n  with check (public.is_admin())");
  });

  it("backfills the 4 new preference keys onto every existing row, and sets them in the column default for new rows", () => {
    expect(migration).toContain('"daily_motivation_enabled": true');
    expect(migration).toContain('"faith_messages_enabled": true');
    expect(migration).toContain('"habit_reminders_enabled": true');
    expect(migration).toContain('"admin_campaign_notifications": true');
    expect(migration).toContain("alter column notifications set default");
    expect(migration).toContain("update public.user_preferences");
  });

  it("extends the audience_type CHECK with all 6 new values while keeping every prior one", () => {
    for (const value of [
      "streak_above_threshold",
      "streak_lost",
      "day_all_habits_completed",
      "habit_keyword_not_completed_today",
      "automation_habit_reminder",
      "automation_daily_motivation",
      "all_active_users",
      "automation_inactive_user",
    ]) {
      expect(migration).toContain(`'${value}'`);
    }
  });
});

describe("Migration 0054 - smart notifications engine", () => {
  const migration = readMigration("0054_smart_notifications_engine.sql");

  it("challenge_habit_notifications gets a direct admin write policy (for all), mirroring daily_motivation_messages", () => {
    expect(migration).toContain('"Admins can manage habit notification config"');
    expect(migration).toContain("on public.challenge_habit_notifications for all");
  });

  it("resolve_notification_audience's 4 new branches require their driving parameter or return nothing", () => {
    const body = sliceFunction(migration, "resolve_notification_audience");
    expect(body).toContain("if p_min_streak is null then\n      return;\n    end if;");
    expect(body).toContain("if p_habit_keyword is null or length(trim(p_habit_keyword)) = 0 then\n      return;\n    end if;");
  });

  it("habit_keyword_not_completed_today reuses habit_visible_on_day - never bypasses per-day habit visibility", () => {
    const body = sliceFunction(migration, "resolve_notification_audience");
    expect(body).toContain("public.habit_visible_on_day(h.visibility_config, cd.day_number, c.duration_days)");
  });

  it("automation_resolve_smart_notification_candidates never fires outside 07:00-22:00, regardless of configured time (Parte 6)", () => {
    const body = sliceFunction(migration, "automation_resolve_smart_notification_candidates");
    expect(body).toContain("extract(hour from loc.local_now) >= 7");
    expect(body).toContain("extract(hour from loc.local_now) < 22");
  });

  it("habit reminder candidates respect only_if_not_completed by checking today's habit_logs, and gate on habit_reminders_enabled", () => {
    const body = sliceFunction(migration, "automation_resolve_smart_notification_candidates");
    expect(body).toContain("coalesce((up.notifications ->> 'habit_reminders_enabled')::boolean, true)");
    expect(body).toContain("not chn.only_if_not_completed");
    expect(body).toContain("hl.status = 'completed'");
  });

  it("habit reminder candidates support both weekly (weekdays array) and monthly (monthly_day) frequency", () => {
    const body = sliceFunction(migration, "automation_resolve_smart_notification_candidates");
    expect(body).toContain("chn.frequency_type = 'weekly'");
    expect(body).toContain("w.value::integer = extract(dow from loc.local_date)::integer");
    expect(body).toContain("chn.frequency_type = 'monthly'");
    expect(body).toContain("chn.monthly_day = extract(day from loc.local_date)::integer");
  });

  it("daily motivation candidates gate 'fe' category on faith_messages_enabled and every other category on daily_motivation_enabled", () => {
    const body = sliceFunction(migration, "automation_resolve_smart_notification_candidates");
    expect(body).toContain("p_daily_motivation_category = 'fe'\n          and coalesce((up.notifications ->> 'faith_messages_enabled')::boolean, true)");
    expect(body).toContain("p_daily_motivation_category <> 'fe'\n          and coalesce((up.notifications ->> 'daily_motivation_enabled')::boolean, true)");
  });

  it("anti-spam (Parte 8): excludes anyone notified by an automated habit_reminder/daily_motivation in the last 60 minutes, then picks exactly 1 winner per user by priority", () => {
    const body = sliceFunction(migration, "automation_resolve_smart_notification_candidates");
    expect(body).toContain("n.type in ('habit_reminder', 'daily_motivation')");
    expect(body).toContain("n.sent_at >= now() - interval '60 minutes'");
    expect(body).toContain("partition by ac.user_id\n        order by ac.priority desc, ac.candidate_key asc");
    expect(body).toContain("where rn = 1");
  });

  it("the smart-candidates resolver is locked to service_role only, never authenticated/anon/public", () => {
    expect(migration).toContain(
      "revoke all on function public.automation_resolve_smart_notification_candidates(uuid, text, text, text) from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.automation_resolve_smart_notification_candidates(uuid, text, text, text) to service_role;",
    );
  });
});

describe("Migration 0055 - drop stale notification RPC overloads", () => {
  const migration = readMigration("0055_drop_stale_notification_rpc_overloads.sql");

  it("drops exactly the 4 old-signature overloads created by 0054's additive parameters", () => {
    expect(migration).toContain("drop function if exists public.resolve_notification_audience(text, uuid, uuid);");
    expect(migration).toContain("drop function if exists public.admin_estimate_notification_audience(text, uuid, uuid);");
    expect(migration).toContain(
      "drop function if exists public.admin_create_notification_campaign(text, text, text, text, text, uuid, uuid, text, text, boolean, boolean);",
    );
    expect(migration).toContain(
      "drop function if exists public.admin_update_notification_campaign(uuid, text, text, text, text, text, uuid, uuid, text, text, boolean, boolean);",
    );
  });
});

describe("Migration 0056 - combined-segmentation streak fix", () => {
  const migration = readMigration("0056_notification_audience_combined_streak_fix.sql");

  it("estimate/create/update all pass the same min-streak value as BOTH p_min_streak and p_combined_min_streak - the fix for the silent no-op", () => {
    for (const name of [
      "admin_estimate_notification_audience",
      "admin_create_notification_campaign",
      "admin_update_notification_campaign",
    ]) {
      const body = sliceFunction(migration, name);
      expect(body, `${name} missing resolve_notification_audience_combined call`).toMatch(
        /resolve_notification_audience_combined\(\s*p_audience_type, p_challenge_id, p_specific_user_id, p_min_strea(k|k_threshold), p_habit_keyword, p_min_strea(k|k_threshold)\s*\)/,
      );
    }
  });
});

describe("Migration 0057 - notification campaign period summary", () => {
  const migration = readMigration("0057_notification_period_summary.sql");

  it("aggregates campaigns_sent/notifications_sent/opened/clicked/failed in one query, not N+1", () => {
    const body = sliceFunction(migration, "admin_notification_campaign_period_summary");
    expect(body).toContain("count(distinct nc.id) filter (where nc.status in ('sent', 'partially_failed', 'failed'))");
    expect(body).toContain("count(*) filter (where nd.status = 'failed')");
  });

  it("requires admin before returning any data", () => {
    const body = sliceFunction(migration, "admin_notification_campaign_period_summary");
    expect(body).toContain("perform public.admin_require_admin();");
  });
});

describe("Migration 0058 - admin_campaign_notifications preference gate", () => {
  const migration = readMigration("0058_admin_campaign_notifications_preference_gate.sql");

  it("every manual audience branch now also filters on admin_campaign_notifications", () => {
    const body = sliceFunction(migration, "resolve_notification_audience");
    const occurrences = body.match(/admin_campaign_notifications/g) ?? [];
    // 12 audience-type branches in the function, each filtering once.
    expect(occurrences.length).toBeGreaterThanOrEqual(12);
  });

  it("defaults to true (opted-in) for users who never set the preference, never silently drops them", () => {
    const body = sliceFunction(migration, "resolve_notification_audience");
    expect(body).toContain("coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true)");
  });

  it("keeps the exact same function signature as before (create or replace truly replaces, not a new overload)", () => {
    expect(migration).toContain(
      "revoke all on function public.resolve_notification_audience(text, uuid, uuid, integer, text) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.resolve_notification_audience(text, uuid, uuid, integer, text) to authenticated, service_role;",
    );
  });
});
