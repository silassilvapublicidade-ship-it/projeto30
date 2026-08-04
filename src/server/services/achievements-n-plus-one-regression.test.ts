import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "services", "achievements.service.ts"), "utf8");
}

/**
 * Regression coverage for the achievements N+1 fix. Before this round, the 5
 * progress-count queries ran once per LOCKED ACHIEVEMENT even though every
 * achievement in the same challenge shares the same representative
 * enrollment - 5 x L queries for L locked achievements. Now they run once
 * per DISTINCT representative enrollment, before the achievement loop.
 * These tests assert the structural shape that keeps that true, not just
 * that it happens to be true today.
 */
describe("achievements.service.ts - no N+1 in getMemberAchievements", () => {
  const source = readSource();

  it("extracts the 5 progress-count queries into a standalone per-enrollment helper, not inline in the achievement loop", () => {
    expect(source).toContain("async function getProgressStatsForEnrollment(");
    const helperStart = source.indexOf("async function getProgressStatsForEnrollment(");
    const helperBody = source.slice(helperStart, source.indexOf("\nexport async function getMemberAchievements", helperStart));
    expect(helperBody).toContain('.from("habit_logs")');
    expect(helperBody).toContain('.from("journal_entries")');
    expect(helperBody).toContain('.from("daily_logs")');
  });

  it("resolves the representative enrollment once per CHALLENGE, before the achievement loop - never inside it", () => {
    const loopStart = source.indexOf("for (const achievement of challengeAchievements ?? []) {");
    const beforeLoop = source.slice(0, loopStart);
    const loopBody = source.slice(loopStart, source.indexOf("\n\n  const participatedChallenges", loopStart));

    expect(beforeLoop).toContain("const representativeByChallenge = new Map");
    expect(beforeLoop).toContain("pickRepresentativeEnrollment(enrollmentsForChallenge)");
    // The loop only ever looks the representative up (a Map.get), it never
    // calls pickRepresentativeEnrollment itself.
    expect(loopBody).not.toContain("pickRepresentativeEnrollment(");
  });

  it("fetches progress stats once per DISTINCT enrollment id, not once per achievement", () => {
    const loopStart = source.indexOf("for (const achievement of challengeAchievements ?? []) {");
    const beforeLoop = source.slice(0, loopStart);
    const loopBody = source.slice(loopStart, source.indexOf("\n\n  const participatedChallenges", loopStart));

    expect(beforeLoop).toContain("const distinctEnrollmentIds = Array.from(");
    expect(beforeLoop).toContain("new Set(Array.from(representativeByChallenge.values())");
    expect(beforeLoop).toContain("getProgressStatsForEnrollment(supabase, enrollmentId)");
    // Inside the loop, stats are looked up from the precomputed map - no
    // await, no query, no call to the stats-fetching helper.
    expect(loopBody).not.toContain("getProgressStatsForEnrollment(");
    expect(loopBody).toContain("statsByEnrollmentId.get(representative.id)");
  });

  it("still computes progress with getAchievementProgress using the exact same field names as before - only the query count changed, never the logic", () => {
    const callStart = source.indexOf("progress = getAchievementProgress(achievement.slug, {");
    const callBody = source.slice(callStart, source.indexOf("});", callStart));
    for (const field of [
      "completedCycle: representative.status === \"completed\"",
      "completedHabitsLifetime: stats.completedHabitsLifetime",
      "durationDays: challenge.duration_days",
      "finalizedDays: stats.finalizedDays",
      "physicalActivityCompletions: stats.physicalActivityCompletions",
      "readingCompletions: stats.readingCompletions",
      "reflectionDays: stats.reflectionDays",
      "returnStrong: false",
      "streakCurrent: representative.streak_current",
    ]) {
      expect(callBody).toContain(field);
    }
  });

  it("every stats query stays scoped to the given enrollmentId - ownership/RLS-independent filtering is unchanged", () => {
    const helperStart = source.indexOf("async function getProgressStatsForEnrollment(");
    const helperBody = source.slice(helperStart, source.indexOf("\nexport async function getMemberAchievements", helperStart));
    const scopedFilters = helperBody.match(/\.eq\("(daily_logs\.enrollment_id|enrollment_id)", enrollmentId\)/g) ?? [];
    expect(scopedFilters.length).toBeGreaterThanOrEqual(4);
  });

  it("the base queries (unlocked, enrollments, challenge achievements, challenges) still run exactly once each, unrelated to achievement count", () => {
    expect(source.match(/\.from\("user_achievements"\)/g) ?? []).toHaveLength(1);
    expect(source.match(/\.from\("challenge_enrollments"\)/g) ?? []).toHaveLength(1);
    expect(source.match(/\.from\("achievements"\)/g) ?? []).toHaveLength(1);
    expect(source.match(/\.from\("challenges"\)/g) ?? []).toHaveLength(1);
  });

  it("locked achievements without a matching challenge/representative still push a null-progress entry instead of being silently dropped", () => {
    expect(source).toContain("let progress: AchievementProgress | null = null;");
    expect(source).toContain("locked.push({\n      ...achievement,\n      challengeName: challenge?.name ?? null,\n      progress,\n    });");
  });
});
