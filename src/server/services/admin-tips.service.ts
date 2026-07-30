import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

const TIP_TYPE = "tip";

export type AdminTipRow = Tables<"content_items"> & {
  challenge_name: string | null;
};

export type AdminServiceResult<T> = { data: T; error: null } | { data: null; error: string };

function toErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Erro inesperado.";
}

/**
 * Full admin listing - every status, no pagination. Tip cards are
 * low-volume editorial content (unlike enrollments/participants), so unlike
 * listAdminChallenges this never needed a paginated RPC; a single ordered
 * select is enough. Order matches the member-facing rule (display_order,
 * then published_at, then created_at, then id) so what the admin sees in
 * the list is the same relative order members will see once published.
 */
export async function listAdminTips(): Promise<AdminServiceResult<AdminTipRow[]>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("content_items")
    .select("*, challenge:challenges(name)")
    .eq("type", TIP_TYPE)
    .order("display_order", { ascending: true })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  const rows = (data ?? []).map((row) => {
    const { challenge, ...rest } = row as typeof row & {
      challenge: { name: string } | null;
    };
    return { ...rest, challenge_name: challenge?.name ?? null };
  });

  return { data: rows, error: null };
}

export type ChallengeOption = { id: string; name: string };

/** Populates the optional "desafio relacionado" select in the tip form. */
export async function listChallengesForTipPicker(): Promise<ChallengeOption[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("challenges")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  return data ?? [];
}

export async function getAdminTipById(
  id: string,
): Promise<AdminServiceResult<Tables<"content_items">>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", id)
    .eq("type", TIP_TYPE)
    .maybeSingle();

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  if (!data) {
    return { data: null, error: "Dica não encontrada." };
  }

  return { data, error: null };
}
