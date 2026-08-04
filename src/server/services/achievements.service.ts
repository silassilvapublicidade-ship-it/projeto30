import "server-only";

import { getAchievementProgress, type AchievementProgress } from "@/features/achievements/achievements.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ProgressStats = {
  completedHabitsLifetime: number;
  finalizedDays: number;
  physicalActivityCompletions: number;
  readingCompletions: number;
  reflectionDays: number;
};

type AchievementFields = Pick<
  Tables<"achievements">,
  | "category"
  | "challenge_id"
  | "description"
  | "icon"
  | "id"
  | "name"
  | "points_bonus"
  | "rarity"
  | "share_message"
  | "share_title"
  | "slug"
>;

export type UnlockedAchievement = AchievementFields & {
  challengeName: string | null;
  unlockedAt: string;
  userAchievementId: string;
};

export type LockedAchievement = AchievementFields & {
  challengeName: string | null;
  progress: AchievementProgress | null;
};

export type MemberAchievements = {
  locked: LockedAchievement[];
  participatedChallenges: Array<{ id: string; name: string }>;
  unlocked: UnlockedAchievement[];
};

function pickRepresentativeEnrollment(
  enrollments: Tables<"challenge_enrollments">[],
): Tables<"challenge_enrollments"> {
  const statusRank: Record<Tables<"challenge_enrollments">["status"], number> = {
    active: 0,
    paused: 1,
    completed: 2,
    restarted: 3,
    abandoned: 4,
  };

  return [...enrollments].sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return b.joined_at.localeCompare(a.joined_at);
  })[0]!;
}

/**
 * The 5 counts a locked achievement's progress is derived from, scoped to
 * ONE enrollment. Previously re-run once per LOCKED ACHIEVEMENT even though
 * every achievement belonging to the same challenge shares the exact same
 * representative enrollment (the N+1: 5 x L queries for L locked
 * achievements). Now called once per DISTINCT representative enrollment
 * instead, before the achievement loop - see getMemberAchievements.
 */
async function getProgressStatsForEnrollment(
  supabase: SupabaseServerClient,
  enrollmentId: string,
): Promise<ProgressStats> {
  const [
    { count: completedHabitsLifetime },
    { count: readingCompletions },
    { count: physicalActivityCompletions },
    { count: reflectionDays },
    { count: finalizedDays },
  ] = await Promise.all([
    supabase
      .from("habit_logs")
      .select("id, daily_logs!inner(enrollment_id)", { count: "exact", head: true })
      .eq("status", "completed")
      .eq("daily_logs.enrollment_id", enrollmentId),
    supabase
      .from("habit_logs")
      .select("id, daily_logs!inner(enrollment_id), habits!inner(habit_type)", {
        count: "exact",
        head: true,
      })
      .eq("status", "completed")
      .eq("daily_logs.enrollment_id", enrollmentId)
      .eq("habits.habit_type", "reading"),
    supabase
      .from("habit_logs")
      .select("id, daily_logs!inner(enrollment_id), habits!inner(category,icon)", {
        count: "exact",
        head: true,
      })
      .eq("status", "completed")
      .eq("daily_logs.enrollment_id", enrollmentId)
      .in("habits.category", ["corpo", "atividade fisica", "atividade física", "fisico", "físico"]),
    supabase
      .from("journal_entries")
      .select("id, daily_logs!inner(enrollment_id)", { count: "exact", head: true })
      .eq("daily_logs.enrollment_id", enrollmentId),
    supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", enrollmentId)
      .eq("status", "finalized"),
  ]);

  return {
    completedHabitsLifetime: completedHabitsLifetime ?? 0,
    finalizedDays: finalizedDays ?? 0,
    physicalActivityCompletions: physicalActivityCompletions ?? 0,
    readingCompletions: readingCompletions ?? 0,
    reflectionDays: reflectionDays ?? 0,
  };
}

export async function getMemberAchievements(): Promise<MemberAchievements> {
  const user = await requireAuthUser("/app/conquistas");
  const supabase = await createSupabaseServerClient();

  const [{ data: unlockedRows }, { data: enrollments }] = await Promise.all([
    supabase
      .from("user_achievements")
      .select(
        "id, unlocked_at, achievement:achievements(id,name,description,icon,category,rarity,share_title,share_message,points_bonus,challenge_id,slug,challenge:challenges(name))",
      )
      .eq("user_id", user.id)
      .order("unlocked_at", { ascending: false }),
    supabase.from("challenge_enrollments").select("*").eq("user_id", user.id),
  ]);

  const unlocked: UnlockedAchievement[] = (unlockedRows ?? []).flatMap((row) => {
    const achievement = row.achievement;
    if (!achievement) return [];

    const { challenge, ...achievementFields } = achievement;

    return [
      {
        ...achievementFields,
        challengeName: challenge?.name ?? null,
        unlockedAt: row.unlocked_at,
        userAchievementId: row.id,
      },
    ];
  });

  const unlockedAchievementIds = new Set(unlocked.map((achievement) => achievement.id));

  const enrollmentsByChallenge = new Map<string, Tables<"challenge_enrollments">[]>();
  for (const enrollment of enrollments ?? []) {
    enrollmentsByChallenge.set(enrollment.challenge_id, [
      ...(enrollmentsByChallenge.get(enrollment.challenge_id) ?? []),
      enrollment,
    ]);
  }

  const challengeIds = Array.from(enrollmentsByChallenge.keys());

  if (challengeIds.length === 0) {
    return { locked: [], participatedChallenges: [], unlocked };
  }

  const [{ data: challengeAchievements }, { data: challengeRows }] = await Promise.all([
    supabase
      .from("achievements")
      .select(
        "id,name,description,icon,category,rarity,share_title,share_message,points_bonus,challenge_id,slug",
      )
      .in("challenge_id", challengeIds)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("challenges").select("id,name,duration_days").in("id", challengeIds),
  ]);

  const challengeById = new Map((challengeRows ?? []).map((challenge) => [challenge.id, challenge]));

  // One representative enrollment per challenge (deterministic, same pick
  // every achievement in that challenge would have computed individually
  // before) - resolved once, outside the achievement loop.
  const representativeByChallenge = new Map<string, Tables<"challenge_enrollments">>();
  for (const [challengeIdKey, enrollmentsForChallenge] of enrollmentsByChallenge) {
    if (enrollmentsForChallenge.length > 0) {
      representativeByChallenge.set(challengeIdKey, pickRepresentativeEnrollment(enrollmentsForChallenge));
    }
  }

  // The 5-count progress stats only vary per enrollment, not per
  // achievement - fetched once per DISTINCT representative enrollment
  // (constant relative to the number of locked achievements) instead of
  // once per achievement.
  const distinctEnrollmentIds = Array.from(
    new Set(Array.from(representativeByChallenge.values()).map((enrollment) => enrollment.id)),
  );
  const statsEntries = await Promise.all(
    distinctEnrollmentIds.map(
      async (enrollmentId) => [enrollmentId, await getProgressStatsForEnrollment(supabase, enrollmentId)] as const,
    ),
  );
  const statsByEnrollmentId = new Map(statsEntries);

  const locked: LockedAchievement[] = [];

  for (const achievement of challengeAchievements ?? []) {
    if (unlockedAchievementIds.has(achievement.id)) {
      continue;
    }

    const challenge = challengeById.get(achievement.challenge_id);
    const representative = representativeByChallenge.get(achievement.challenge_id) ?? null;

    let progress: AchievementProgress | null = null;

    if (representative && challenge) {
      const stats = statsByEnrollmentId.get(representative.id);

      if (stats) {
        progress = getAchievementProgress(achievement.slug, {
          completedCycle: representative.status === "completed",
          completedHabitsLifetime: stats.completedHabitsLifetime,
          durationDays: challenge.duration_days,
          finalizedDays: stats.finalizedDays,
          physicalActivityCompletions: stats.physicalActivityCompletions,
          readingCompletions: stats.readingCompletions,
          reflectionDays: stats.reflectionDays,
          returnStrong: false,
          streakCurrent: representative.streak_current,
        });
      }
    }

    locked.push({
      ...achievement,
      challengeName: challenge?.name ?? null,
      progress,
    });
  }

  const participatedChallenges = Array.from(challengeById.values()).map((challenge) => ({
    id: challenge.id,
    name: challenge.name,
  }));

  return { locked, participatedChallenges, unlocked };
}
