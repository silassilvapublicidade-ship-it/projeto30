import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type ChallengeEditorHabit = Tables<"habits">;

export type ChallengeEditorData = {
  challenge: Tables<"challenges">;
  daysCount: number;
  habits: ChallengeEditorHabit[];
  hasParticipants: boolean;
  participantCount: number;
};

/**
 * All reads needed by the admin challenge editor (novo/editar/preview). Uses
 * the caller's own authenticated server client - RLS already grants
 * admin/super_admin full access to challenges/habits/challenge_days/
 * challenge_enrollments (0001_initial_schema.sql), so no service-role client
 * is needed here, matching the existing admin-challenges.actions.ts pattern.
 */
export async function getChallengeEditorData(challengeId: string): Promise<ChallengeEditorData | null> {
  const supabase = await createSupabaseServerClient();

  const [{ data: challenge }, { data: habits }, { count: daysCount }, { count: participantCount }] =
    await Promise.all([
      supabase.from("challenges").select("*").eq("id", challengeId).maybeSingle(),
      supabase
        .from("habits")
        .select("*")
        .eq("challenge_id", challengeId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("challenge_days")
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", challengeId),
      supabase
        .from("challenge_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", challengeId),
    ]);

  if (!challenge) {
    return null;
  }

  return {
    challenge,
    daysCount: daysCount ?? 0,
    habits: habits ?? [],
    hasParticipants: (participantCount ?? 0) > 0,
    participantCount: participantCount ?? 0,
  };
}

export async function challengeHasParticipants(challengeId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("challenge_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId);

  return (count ?? 0) > 0;
}
