import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AdminServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export type AdminAchievementRow = Tables<"achievements"> & {
  challenge_name: string;
};

export type AdminAchievementDeletePreview = {
  achievement_id: string;
  can_delete: boolean;
  challenge_id: string;
  name: string;
  unlocked_count: number;
};

function toErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) {
    return "Não foi possível concluir a operação agora.";
  }

  if (error.code === "42501") {
    return "Acesso administrativo necessário.";
  }

  if (error.code === "P0002") {
    return "Conquista não encontrada.";
  }

  if (error.code === "P0003") {
    return "Esta conquista já foi desbloqueada por pelo menos um usuário e não pode ser excluída. Desative-a em vez disso.";
  }

  if (error.code === "23505") {
    return "Este desafio já tem uma conquista deste tipo.";
  }

  return "Não foi possível concluir a operação agora. Tente novamente em instantes.";
}

/**
 * Achievements are low-volume editorial content (10 canonical rule types per
 * challenge, same order of magnitude as Dicas) - a single select ordered by
 * challenge then sort_order is enough, no dedicated listing RPC or
 * pagination needed the way the much higher-cardinality participants list
 * needed one.
 */
export async function listAdminAchievements(): Promise<AdminServiceResult<AdminAchievementRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("achievements")
    .select("*, challenge:challenges(name)")
    .order("challenge_id", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  const rows = (data ?? []).map((row) => {
    const { challenge, ...rest } = row;
    return { ...rest, challenge_name: challenge?.name ?? "—" };
  });

  return { data: rows, error: null };
}

export async function getAdminAchievementById(
  id: string,
): Promise<AdminServiceResult<AdminAchievementRow>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("achievements")
    .select("*, challenge:challenges(name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  const { challenge, ...rest } = data;
  return { data: { ...rest, challenge_name: challenge?.name ?? "—" }, error: null };
}

/**
 * The slugs already in use for a challenge, so the create form can only
 * offer rule types not yet taken (achievements_scope_slug_unique enforces
 * one achievement per (challenge_id, slug) - this just turns a would-be
 *23505 into an upfront, friendlier list of available options).
 */
export async function listUsedAchievementSlugsForChallenge(
  challengeId: string,
): Promise<AdminServiceResult<string[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("achievements")
    .select("slug")
    .eq("challenge_id", challengeId);

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: (data ?? []).map((row) => row.slug), error: null };
}

export async function getAdminAchievementDeletePreview(
  achievementId: string,
): Promise<AdminServiceResult<AdminAchievementDeletePreview>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_achievement_delete_preview", {
    p_achievement_id: achievementId,
  });

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminAchievementDeletePreview, error: null };
}

export { toErrorMessage as achievementErrorMessage };
