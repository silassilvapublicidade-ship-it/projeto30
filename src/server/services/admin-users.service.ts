import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AdminUserRow = Pick<
  Tables<"users">,
  | "avatar_url"
  | "created_at"
  | "display_name"
  | "email"
  | "id"
  | "must_change_password"
  | "name"
  | "onboarding_completed"
  | "role"
  | "status"
>;

export type AdminServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export const ADMIN_USER_PAGE_SIZE = 20;

export type AdminUserListParams = {
  page?: number | undefined;
  search?: string | undefined;
};

function toErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Erro inesperado.";
}

/** Mirrors the pattern established for tip cards: query-level errors return
 * gracefully, but a network-level throw (fetch rejecting) must not escape
 * uncaught and crash the whole /admin route tree. */
function logUnexpectedFailure(operation: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ADMIN_USERS_LOAD_FAILED] ${operation}:`, message);
  return "Não foi possível carregar os dados agora. Tente novamente em alguns segundos.";
}

export async function listAdminUsers(
  params: AdminUserListParams = {},
): Promise<AdminServiceResult<{ rows: AdminUserRow[]; totalCount: number }>> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * ADMIN_USER_PAGE_SIZE;

  let query = supabase
    .from("users")
    .select(
      "id, email, name, display_name, avatar_url, role, status, onboarding_completed, must_change_password, created_at",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (params.search) {
    query = query.or(`email.ilike.%${params.search}%,name.ilike.%${params.search}%,display_name.ilike.%${params.search}%`);
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + ADMIN_USER_PAGE_SIZE - 1);

  try {
    const { count, data, error } = await query;

    if (error) {
      return { data: null, error: toErrorMessage(error) };
    }

    return { data: { rows: data ?? [], totalCount: count ?? (data ?? []).length }, error: null };
  } catch (caughtError) {
    return { data: null, error: logUnexpectedFailure("listAdminUsers", caughtError) };
  }
}

export type PublishedChallengeOption = { id: string; name: string };

/**
 * "Desafio publicado" in the product's own vocabulary is status = 'active'
 * in this schema (see the Desafios admin list's own status options / the
 * "Anyone can read active challenges" RLS policy) - there is no literal
 * 'published' enum value.
 */
export async function listPublishedChallengesForEnrollPicker(): Promise<PublishedChallengeOption[]> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("challenges")
      .select("id, name")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      logUnexpectedFailure("listPublishedChallengesForEnrollPicker", error);
      return [];
    }

    return data ?? [];
  } catch (caughtError) {
    logUnexpectedFailure("listPublishedChallengesForEnrollPicker", caughtError);
    return [];
  }
}
