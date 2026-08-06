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

describe("Migration 0046 - notification-images bucket", () => {
  const migration = readMigration("0046_notification_images_bucket.sql");

  it("configures file_size_limit and allowed_mime_types at bucket creation (defense in depth), never as a later patch", () => {
    expect(migration).toContain("insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)");
    expect(migration).toContain("10485760, -- 10 MB");
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
  });

  it("restricts writes to admins only, read is public", () => {
    expect(migration).toContain('"Notification images are publicly readable"');
    expect(migration).toContain('"Admins can manage notification images"');
    expect(migration).toContain("bucket_id = 'notification-images' and public.is_admin()");
  });
});

describe("Migration 0047 - automation audience_type CHECK extension", () => {
  const migration = readMigration("0047_notification_automation_audience_types.sql");

  it("keeps every original admin audience type while adding the 7 automation-only ones", () => {
    for (const value of [
      "all_active_users",
      "specific_user",
      "challenge_participants",
      "active_enrollment",
      "day_not_finalized",
      "day_finalized",
      "push_enabled",
      "push_disabled_internal_only",
      "admins",
      "super_admins",
      "automation_daily_reminder",
      "automation_challenge_starting_tomorrow",
      "automation_challenge_starting_today",
      "automation_challenge_ending_soon",
      "automation_new_tip",
      "automation_achievement_unlocked",
      "automation_inactive_user",
    ]) {
      expect(migration).toContain(`'${value}'`);
    }
  });
});

describe("Migration 0048 - automation audience resolvers", () => {
  const migration = readMigration("0048_notification_automation_resolvers.sql");

  it("every resolver is security definer, locked search_path, and granted to service_role only (never authenticated/anon/public)", () => {
    const names = [
      "automation_resolve_daily_reminder_audience",
      "automation_resolve_challenge_date_audience",
      "automation_resolve_inactive_users_audience",
      "automation_resolve_new_tip_subscribers_audience",
      "automation_resolve_specific_users_audience",
    ];
    for (const name of names) {
      const body = sliceFunction(migration, name);
      expect(body, `${name} missing security definer`).toContain("security definer");
      expect(body, `${name} missing search_path`).toContain("set search_path = public, pg_temp");
    }
    expect(migration).toContain("grant execute on function public.automation_resolve_daily_reminder_audience() to service_role;");
    expect(migration).not.toMatch(/automation_resolve_\w+ to authenticated/);
  });

  it("daily reminder only fires within the mandated 07:00-22:00 local window and only for opted-in, unfinalized users", () => {
    const body = sliceFunction(migration, "automation_resolve_daily_reminder_audience");
    expect(body).toContain("between 7 and 21");
    expect(body).toContain("coalesce((up.notifications ->> 'daily_reminder_enabled')::boolean, false)");
    expect(body).toContain("dl.status = 'finalized'");
  });

  it("challenge start/end date automations use the challenge's own start_date/end_date, not personal_start_date, on a fixed reference timezone", () => {
    const body = sliceFunction(migration, "automation_resolve_challenge_date_audience");
    expect(body).toContain("timezone('America/Sao_Paulo', now())::date");
    expect(body).toContain("c.start_date = v_target_date");
    expect(body).toContain("c.end_date = v_target_date");
    expect(body).not.toContain("personal_start_date");
  });

  it("inactive-user resolver requires an active enrollment with zero finalized days in the window, gated on a real preference key", () => {
    const body = sliceFunction(migration, "automation_resolve_inactive_users_audience");
    expect(body).toContain("dl.status = 'finalized'");
    expect(body).toContain("coalesce((up.notifications ->> 'important_updates_notifications')::boolean, true)");
  });

  it("new-tip and achievement resolvers gate on their own specific preference key, not a generic one", () => {
    const tipBody = sliceFunction(migration, "automation_resolve_new_tip_subscribers_audience");
    expect(tipBody).toContain("coalesce((up.notifications ->> 'new_tip_notifications')::boolean, true)");
    const achievementBody = sliceFunction(migration, "automation_resolve_specific_users_audience");
    expect(achievementBody).toContain("coalesce((up.notifications ->> 'achievement_notifications')::boolean, true)");
  });
});

describe("Migration 0092 - generic challenge launch campaign", () => {
  const migration = readMigration("0092_challenge_launch_campaign.sql");

  it("creates the launch campaign steps table with a fixed 5-step_key CHECK and a unique(challenge_id, step_key) constraint", () => {
    expect(migration).toContain("create table public.challenge_launch_campaign_steps");
    for (const stepKey of [
      "seven_days_before",
      "three_days_before",
      "one_day_before",
      "launch_day",
      "launch_day_followup",
    ]) {
      expect(migration).toContain(`'${stepKey}'`);
    }
    expect(migration).toContain(
      "constraint challenge_launch_campaign_steps_challenge_step_key unique (challenge_id, step_key)",
    );
  });

  it("mirrors challenge_habit_notifications' RLS shape - public read, admin-only write, no RPC needed", () => {
    expect(migration).toContain('"Anyone can read launch campaign config"');
    expect(migration).toContain("for select");
    expect(migration).toContain('"Admins can manage launch campaign config"');
    expect(migration).toContain("using (public.is_admin())");
    expect(migration).toContain("with check (public.is_admin())");
  });

  it("resolver is security definer, locked search_path, granted to service_role only", () => {
    const body = sliceFunction(migration, "automation_resolve_challenge_launch_audience");
    expect(body).toContain("security definer");
    expect(body).toContain("set search_path = public, pg_temp");
    expect(migration).toContain(
      "grant execute on function public.automation_resolve_challenge_launch_audience(uuid) to service_role;",
    );
    expect(migration).not.toMatch(/automation_resolve_challenge_launch_audience\([^)]*\) to authenticated/);
  });

  it("resolver is the mirror image of the enrolled-only reminder resolver - explicitly EXCLUDES already-enrolled users, reuses the existing challenge_start_notifications preference (no new preference key)", () => {
    const body = sliceFunction(migration, "automation_resolve_challenge_launch_audience");
    expect(body).toContain("not exists (");
    expect(body).toContain("from public.challenge_enrollments ce");
    expect(body).toContain("ce.challenge_id = p_challenge_id and ce.user_id = u.id");
    expect(body).toContain("coalesce((up.notifications ->> 'challenge_start_notifications')::boolean, true)");
  });

  it("adds automation_challenge_launch to the audience_type CHECK without dropping any pre-existing value", () => {
    for (const value of [
      "automation_daily_reminder",
      "automation_challenge_starting_tomorrow",
      "automation_challenge_starting_today",
      "automation_challenge_ending_soon",
      "automation_new_tip",
      "automation_achievement_unlocked",
      "automation_inactive_user",
      "streak_above_threshold",
      "streak_lost",
      "day_all_habits_completed",
      "habit_keyword_not_completed_today",
      "automation_habit_reminder",
      "automation_daily_motivation",
      "automation_challenge_launch",
    ]) {
      expect(migration).toContain(`'${value}'`);
    }
  });
});
