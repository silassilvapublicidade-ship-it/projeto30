import "server-only";

import { getDateOnlyInTimeZone } from "@/features/challenges/date.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

import { requireAuthUser } from "./auth-session.service";

export type EnrollmentWithChallenge = Tables<"challenge_enrollments"> & {
  challenge: Tables<"challenges"> | null;
};

export type CatalogChallenge = Tables<"challenges"> & {
  enrollment: Pick<
    Tables<"challenge_enrollments">,
    | "completion_percent"
    | "current_day"
    | "id"
    | "status"
    | "streak_current"
  > | null;
  habitCount: number;
};

export type MemberChallengeCatalog = {
  activeEnrollments: EnrollmentWithChallenge[];
  catalog: CatalogChallenge[];
  history: EnrollmentWithChallenge[];
  localDate: string;
};

async function getLocalDateForUser(
  userId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data: profile } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  const timezone = profile?.timezone || "America/Sao_Paulo";
  return getDateOnlyInTimeZone(new Date(), timezone);
}

export async function getMemberChallengeCatalog(): Promise<MemberChallengeCatalog> {
  const user = await requireAuthUser("/app/desafios");
  const supabase = await createSupabaseServerClient();
  const localDate = await getLocalDateForUser(user.id, supabase);

  const [{ data: enrollments }, { data: challenges }, { data: habitRows }] = await Promise.all([
    supabase
      .from("challenge_enrollments")
      .select("*, challenge:challenges(*)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
    supabase
      .from("challenges")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("habits").select("challenge_id").eq("active", true),
  ]);

  const habitCountByChallengeId = new Map<string, number>();
  for (const row of habitRows ?? []) {
    habitCountByChallengeId.set(
      row.challenge_id,
      (habitCountByChallengeId.get(row.challenge_id) ?? 0) + 1,
    );
  }

  const typedEnrollments = (enrollments ?? []) as EnrollmentWithChallenge[];
  const activeEnrollments = typedEnrollments.filter(
    (enrollment) => enrollment.status === "active" || enrollment.status === "paused",
  );
  const history = typedEnrollments.filter(
    (enrollment) =>
      enrollment.status === "completed" ||
      enrollment.status === "abandoned" ||
      enrollment.status === "restarted",
  );

  // A user may hold at most one open (active/paused) enrollment PER
  // challenge (enforced by challenge_enrollments_one_active_per_user_challenge),
  // but may hold several simultaneously across different challenges - so
  // this is keyed by challenge_id, not a single "current" enrollment.
  const enrollmentByChallengeId = new Map(
    activeEnrollments.map((enrollment) => [enrollment.challenge_id, enrollment]),
  );

  const catalog: CatalogChallenge[] = (challenges ?? []).map((challenge) => {
    const enrollment = enrollmentByChallengeId.get(challenge.id) ?? null;
    return {
      ...challenge,
      enrollment: enrollment
        ? {
            completion_percent: enrollment.completion_percent,
            current_day: enrollment.current_day,
            id: enrollment.id,
            status: enrollment.status,
            streak_current: enrollment.streak_current,
          }
        : null,
      habitCount: habitCountByChallengeId.get(challenge.id) ?? 0,
    };
  });

  return {
    activeEnrollments,
    catalog,
    history,
    localDate,
  };
}

export type ChallengeDetail = {
  achievements: Array<Pick<Tables<"achievements">, "description" | "icon" | "id" | "name" | "points_bonus">>;
  challenge: Tables<"challenges">;
  habits: Array<
    Pick<
      Tables<"habits">,
      | "category"
      | "description"
      | "frequency_type"
      | "habit_type"
      | "id"
      | "is_required"
      | "points"
      | "title"
      | "validation_config"
    >
  >;
  localDate: string;
  ownEnrollment: Tables<"challenge_enrollments"> | null;
};

export async function getChallengeDetailBySlug(slug: string): Promise<ChallengeDetail | null> {
  const user = await requireAuthUser("/app/desafios");
  const supabase = await createSupabaseServerClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!challenge) {
    return null;
  }

  const localDate = await getLocalDateForUser(user.id, supabase);

  const [{ data: habits }, { data: achievements }, { data: ownEnrollment }] = await Promise.all([
    supabase
      .from("habits")
      .select(
        "id,title,description,category,habit_type,points,is_required,frequency_type,validation_config",
      )
      .eq("challenge_id", challenge.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("achievements")
      .select("id,name,description,icon,points_bonus")
      .eq("challenge_id", challenge.id)
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("challenge_enrollments")
      .select("*")
      .eq("challenge_id", challenge.id)
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    achievements: achievements ?? [],
    challenge,
    habits: habits ?? [],
    localDate,
    ownEnrollment: ownEnrollment ?? null,
  };
}
