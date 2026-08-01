import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0032_advanced_analytics_rpcs.sql"),
    "utf8",
  );
}

describe("advanced analytics SQL migration", () => {
  const migration = readMigration();

  it("reproduces admin_challenge_funnel's original 8-stage 'stages' array byte-for-byte (0017 is already a live consumer)", () => {
    const stageKeys = [
      "detail_viewed",
      "join_clicked",
      "joined",
      "first_habit",
      "day_7",
      "halfway",
      "completed",
      "abandoned",
    ];

    for (const key of stageKeys) {
      expect(migration).toContain(`'key', '${key}'`);
    }

    // Same 8 event-based counts computed the exact same way as 0017.
    expect(migration).toContain("count(*) filter (where event_name = 'challenge_detail_viewed')");
    expect(migration).toContain("count(*) filter (where event_name = 'challenge_join_clicked')");
    expect(migration).toContain(
      "count(distinct enrollment_id) filter (where event_name = 'challenge_joined')",
    );
    expect(migration).toContain("v_stages := jsonb_build_array(");
    expect(migration).toContain("'stages', v_stages,");
  });

  it("admin_challenge_funnel adds new metrics alongside stages, never replacing it", () => {
    const funnelBody = migration.split("function public.admin_challenge_funnel(")[1]?.split("$$;")[0];
    expect(funnelBody).toBeDefined();

    for (const field of [
      "challenge_id",
      "challenge_name",
      "earliest_event_at",
      "global_catalog_views",
      "joins_completed_real",
      "day1_completed",
      "day3_completed",
      "halfway_day",
      "halfway_completed_real",
      "completed_real",
      "abandoned_real",
      "currently_paused",
      "pause_events",
      "resume_events",
    ]) {
      expect(funnelBody).toContain(`'${field}',`);
    }
  });

  it("computes real funnel numbers from the source tables, not just analytics_events, so pre-instrumentation challenges aren't misrepresented", () => {
    expect(migration).toContain("from public.challenge_enrollments\n  where challenge_id = p_challenge_id;");
    expect(migration).toMatch(/from public\.challenge_enrollments\s*\n\s*where challenge_id = p_challenge_id and status = 'completed';/);
    expect(migration).toMatch(/from public\.challenge_enrollments\s*\n\s*where challenge_id = p_challenge_id and status = 'abandoned';/);
    expect(migration).toMatch(/from public\.challenge_enrollments\s*\n\s*where challenge_id = p_challenge_id and status = 'paused';/);
  });

  it("has no nested function definitions - admin_retention_for_day is its own top-level function", () => {
    // PL/pgSQL doesn't support nested function definitions - a per-day
    // retention helper declared inside admin_challenge_retention's DECLARE
    // section is invalid SQL. It must be a sibling top-level statement,
    // called by admin_challenge_retention rather than nested inside it.
    expect(migration).toMatch(/\n\s*create or replace function public\.admin_retention_for_day\(/);
    const retentionCallerBody = migration
      .split("function public.admin_challenge_retention(")[1]
      ?.split("$$;")[0];
    expect(retentionCallerBody).toBeDefined();
    expect(retentionCallerBody).not.toContain("create or replace function");
  });

  it("admin_retention_for_day gates itself with admin_require_admin (defense in depth, not just the outer wrapper)", () => {
    const retentionBody = migration
      .split("function public.admin_retention_for_day(")[1]
      ?.split("$$;")[0];
    expect(retentionBody).toBeDefined();
    expect(retentionBody).toContain("perform public.admin_require_admin();");
  });

  it("retention eligibility uses journey_calculate_day with the pause offset, never a plain date subtraction", () => {
    expect(migration).toContain(
      "public.journey_calculate_day(\n      ce.personal_start_date, current_date, ce.paused_days_offset\n    ) >= p_day",
    );
  });

  it("admin_challenge_retention computes d1/d3/d7/halfway by calling the shared per-day helper 4 times", () => {
    const body = migration
      .split("function public.admin_challenge_retention(")[1]
      ?.split("$$;")[0];
    expect(body).toBeDefined();
    expect(body).toContain("public.admin_retention_for_day(p_challenge_id, 1)");
    expect(body).toContain("public.admin_retention_for_day(p_challenge_id, 3)");
    expect(body).toContain("public.admin_retention_for_day(p_challenge_id, 7)");
    expect(body).toContain("public.admin_retention_for_day(p_challenge_id, v_halfway_day)");
  });

  it("admin_challenge_detail only adds `required` to habit_adherence - adherence_percent formula is untouched", () => {
    expect(migration).toContain("bool_or(cdh.required) as required,");
    // The percentage formula itself: completed/opportunity * 100, rounded to 2.
    expect(migration).toContain(
      "count(dl.id) filter (where hl.status = 'completed')::numeric",
    );
  });

  it("admin_achievements_analytics never attributes global share events to a specific achievement", () => {
    const body = migration
      .split("function public.admin_achievements_analytics(")[1]
      ?.split("$$;")[0];
    expect(body).toBeDefined();
    expect(body).toContain("v_global_share_started");
    expect(body).toContain("v_global_share_completed");
    // Per-achievement rows come from share_cards (achievement_id is real
    // there), never from analytics_events.
    const perAchievementBlock = body?.split("from (")[1]?.split(") a;")[0];
    expect(perAchievementBlock).not.toContain("analytics_events");
  });

  it("admin_tips_analytics and admin_users_analytics only read published tip cards / non-deleted users", () => {
    const tipsBody = migration.split("function public.admin_tips_analytics(")[1]?.split("$$;")[0];
    expect(tipsBody).toContain("ci.content_type = 'tip_card'");
    expect(tipsBody).toContain("ci.status = 'published'");

    const usersBody = migration.split("function public.admin_users_analytics(")[1]?.split("$$;")[0];
    expect(usersBody).toContain("deleted_at is null");
  });

  it("every new/redefined function is gated by admin_require_admin", () => {
    const functionNames = [
      "admin_challenge_funnel",
      "admin_retention_for_day",
      "admin_challenge_retention",
      "admin_challenge_detail",
      "admin_tips_analytics",
      "admin_achievements_analytics",
      "admin_users_analytics",
    ];

    for (const name of functionNames) {
      const body = migration.split(`function public.${name}(`)[1]?.split("$$;")[0];
      expect(body, `${name} should exist`).toBeDefined();
      expect(body, `${name} should call admin_require_admin`).toContain(
        "perform public.admin_require_admin();",
      );
    }
  });

  it("revokes and grants execute for every new/changed function", () => {
    const functionSignatures = [
      "admin_challenge_funnel(uuid)",
      "admin_retention_for_day(uuid, integer)",
      "admin_challenge_retention(uuid)",
      "admin_tips_analytics()",
      "admin_achievements_analytics()",
      "admin_users_analytics()",
    ];

    for (const signature of functionSignatures) {
      expect(migration).toContain(`revoke all on function public.${signature} from public, anon;`);
      expect(migration).toContain(`grant execute on function public.${signature} to authenticated;`);
    }
  });

  it("never touches point calculation, streak formula or achievement unlock rules", () => {
    expect(migration).not.toContain("insert into public.point_events");
    expect(migration).not.toContain("update public.challenge_enrollments set streak");
    expect(migration).not.toContain("insert into public.user_achievements");
  });
});
