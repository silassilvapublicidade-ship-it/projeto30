import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type UserStatus = Database["public"]["Enums"]["user_status"];

export type AdminUserRow = {
  active_challenge_count: number;
  avatar_url: string | null;
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
  must_change_password: boolean;
  name: string | null;
  onboarding_completed: boolean;
  role: UserRole;
  status: UserStatus;
};

export type AdminServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export const ADMIN_USER_PAGE_SIZE = 20;

export type AdminUserListParams = {
  hasActiveChallenge?: boolean | undefined;
  mustChangePassword?: boolean | undefined;
  page?: number | undefined;
  profileComplete?: boolean | undefined;
  role?: UserRole | undefined;
  search?: string | undefined;
  sortBy?: "created_at" | "name" | "status" | undefined;
  sortDir?: "asc" | "desc" | undefined;
  status?: UserStatus | undefined;
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

  try {
    const { data, error } = await supabase.rpc("admin_list_users", {
      p_has_active_challenge: params.hasActiveChallenge,
      p_limit: ADMIN_USER_PAGE_SIZE,
      p_must_change_password: params.mustChangePassword,
      p_offset: offset,
      p_profile_complete: params.profileComplete,
      p_role: params.role,
      p_search: params.search,
      p_sort_by: params.sortBy,
      p_sort_dir: params.sortDir,
      p_status: params.status,
    });

    if (error) {
      return { data: null, error: toErrorMessage(error) };
    }

    const rows = data ?? [];

    return {
      data: {
        rows: rows.map((row) => ({
          active_challenge_count: row.active_challenge_count,
          avatar_url: row.avatar_url,
          created_at: row.created_at,
          display_name: row.display_name,
          email: row.email,
          id: row.id,
          must_change_password: row.must_change_password,
          name: row.name,
          onboarding_completed: row.onboarding_completed,
          role: row.role,
          status: row.status,
        })),
        totalCount: rows[0]?.total_count ?? 0,
      },
      error: null,
    };
  } catch (caughtError) {
    return { data: null, error: logUnexpectedFailure("listAdminUsers", caughtError) };
  }
}

export type AdminUserEnrollment = {
  challenge_id: string;
  challenge_name: string;
  completed_at: string | null;
  completion_percent: number;
  current_day: number;
  enrollment_id: string;
  joined_at: string;
  personal_start_date: string;
  points_total: number;
  status: Database["public"]["Enums"]["enrollment_status"];
  streak_best: number;
  streak_current: number;
};

export type AdminUserAchievement = {
  achievement_id: string;
  category: string;
  name: string;
  rarity: string;
  unlocked_at: string;
  user_achievement_id: string;
};

export type AdminUserAuditLog = {
  action: string;
  admin_user_id: string | null;
  created_at: string;
};

export type AdminUserDetail = {
  achievements: AdminUserAchievement[];
  enrollments: AdminUserEnrollment[];
  profile: {
    avatar_url: string | null;
    city: string | null;
    created_at: string;
    display_name: string | null;
    email: string;
    id: string;
    must_change_password: boolean;
    name: string | null;
    onboarding_completed: boolean;
    role: UserRole;
    status: UserStatus;
    timezone: string;
    updated_at: string;
  };
  recent_audit_logs: AdminUserAuditLog[];
};

export async function getAdminUserDetail(
  userId: string,
): Promise<AdminServiceResult<AdminUserDetail>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: userId });

    if (error) {
      return { data: null, error: toErrorMessage(error) };
    }

    return { data: data as unknown as AdminUserDetail, error: null };
  } catch (caughtError) {
    return { data: null, error: logUnexpectedFailure("getAdminUserDetail", caughtError) };
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
