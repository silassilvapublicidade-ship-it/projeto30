import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

const TIP_CONTENT_TYPE = "tip_card";

export type AdminTipRow = Tables<"content_items"> & {
  challenge_name: string | null;
};

export type AdminServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export type AdminTipListParams = {
  category?: string | undefined;
  page?: number | undefined;
  search?: string | undefined;
  sortBy?: "created_at" | "display_order" | "published_at" | undefined;
  status?: "archived" | "draft" | "published" | undefined;
};

export const ADMIN_TIP_PAGE_SIZE = 20;

function toErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Erro inesperado.";
}

/**
 * Admin listing with the filters/sort/pagination the round asks for
 * (search by title, category, status, sort, page). Tip cards are
 * low-volume editorial content, so a single filtered/sorted select with an
 * app-layer LIMIT/OFFSET is enough - no dedicated RPC needed the way
 * listAdminChallenges needed one for a much higher-cardinality table.
 */
export async function listAdminTips(
  params: AdminTipListParams = {},
): Promise<AdminServiceResult<{ rows: AdminTipRow[]; totalCount: number }>> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * ADMIN_TIP_PAGE_SIZE;

  let query = supabase
    .from("content_items")
    .select("*, challenge:challenges(name)", { count: "exact" })
    .eq("content_type", TIP_CONTENT_TYPE);

  if (params.search) {
    query = query.ilike("title", `%${params.search}%`);
  }

  if (params.category) {
    query = query.eq("category", params.category);
  }

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.sortBy === "published_at") {
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  } else if (params.sortBy === "created_at") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("display_order", { ascending: true });
  }

  query = query
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(offset, offset + ADMIN_TIP_PAGE_SIZE - 1);

  const { count, data, error } = await query;

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  const rows = (data ?? []).map((row) => {
    const { challenge, ...rest } = row as typeof row & {
      challenge: { name: string } | null;
    };
    return { ...rest, challenge_name: challenge?.name ?? null };
  });

  return { data: { rows, totalCount: count ?? rows.length }, error: null };
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
    .eq("content_type", TIP_CONTENT_TYPE)
    .maybeSingle();

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  if (!data) {
    return { data: null, error: "Dica não encontrada." };
  }

  return { data, error: null };
}
