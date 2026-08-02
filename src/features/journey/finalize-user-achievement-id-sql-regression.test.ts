import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0039_finalize_returns_user_achievement_id.sql"),
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
 * Regression coverage for a real gap found while auditing the
 * achievement-unlock -> share-card pipeline end to end: unlocked_achievements
 * only ever carried achievement_record.id (the static achievements.id), not
 * the user_achievements.id row inserted for THIS unlock. The share-card
 * endpoint (GET /api/achievements/[userAchievementId]/share-card) can only
 * look up a card by user_achievements.id - achievement.id alone fails its
 * ownership check. Without this fix, a client showing "you just unlocked X,
 * here's the card" had no id it could actually use to fetch that card.
 */
describe("Migration 0039 - finalize_daily_log_with_responses returns user_achievement_id", () => {
  const migration = readMigration();
  const body = sliceFunction(
    migration,
    "create or replace function public.finalize_daily_log_with_responses",
    "$$;",
  );

  it("declares a variable to capture the just-inserted user_achievements.id", () => {
    expect(body).toContain("new_user_achievement_id uuid;");
  });

  it("resets the capture variable before each insert attempt, so a DO NOTHING conflict never leaks the previous loop iteration's id", () => {
    const loopBody = body.slice(body.indexOf("for achievement_record in"));
    expect(loopBody).toContain("new_user_achievement_id := null;");
    const resetIndex = loopBody.indexOf("new_user_achievement_id := null;");
    const insertIndex = loopBody.indexOf("insert into public.user_achievements");
    expect(resetIndex).toBeLessThan(insertIndex);
  });

  it("captures the inserted id via returning, right after the on conflict clause", () => {
    expect(body).toContain(
      "on conflict (user_id, enrollment_id, achievement_id) do nothing\n      returning id into new_user_achievement_id;",
    );
  });

  it("only trusts new_user_achievement_id inside the `if found` branch (a DO NOTHING conflict must never surface a stale/null id)", () => {
    const foundBranch = body.split("if found then")[1]?.split("if achievement_record.points_bonus > 0 then")[0];
    expect(foundBranch).toBeDefined();
    expect(foundBranch).toContain("'user_achievement_id', new_user_achievement_id");
  });

  it("keeps every other unlocked_achievements field unchanged (id, name, slug, icon, points_bonus)", () => {
    expect(body).toContain("'id', achievement_record.id,");
    expect(body).toContain("'name', achievement_record.name,");
    expect(body).toContain("'slug', achievement_record.slug,");
    expect(body).toContain("'icon', achievement_record.icon,");
    expect(body).toContain("'points_bonus', achievement_record.points_bonus");
  });

  it("does not touch the idempotent early-return path (still returns an empty unlocked_achievements list, no user_achievement_id needed there)", () => {
    const idempotentBranch = body.split("if daily_record.status = 'finalized' then")[1]?.split("end if;")[0];
    expect(idempotentBranch).toBeDefined();
    expect(idempotentBranch).not.toContain("new_user_achievement_id");
  });

  it("does not change any points/streak/achievement condition formula", () => {
    expect(body).toContain("'tres-dias-seguidos' and streak_count >= 3");
    expect(body).toContain("'primeira-semana' and finalized_days >= 7");
    expect(body).toContain("all_habits_bonus_points");
  });

  it("keeps the function's signature, grants and idempotency comment intact", () => {
    expect(migration).toContain(
      "create or replace function public.finalize_daily_log_with_responses(\n  target_daily_log_id uuid,\n  responses jsonb default '[]'::jsonb\n)",
    );
    expect(migration).toContain(
      "grant execute on function public.finalize_daily_log_with_responses(uuid, jsonb) to authenticated;",
    );
    expect(migration).not.toContain("drop function");
  });
});
