import "server-only";

import type {
  ChallengeListParams,
  ParticipantListParams,
} from "@/features/admin/admin-analytics.schemas";
import { ADMIN_PAGE_SIZE, getOffset } from "@/features/admin/admin-analytics.schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ChallengeStatus = Database["public"]["Enums"]["challenge_status"];
type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];
type UserRole = Database["public"]["Enums"]["user_role"];

export type AdminServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export type AdminDashboardOverview = {
  active_participants: number;
  active_window_days: number;
  average_progress_percent: number;
  challenges_active: number;
  challenges_draft: number;
  challenges_ended_or_archived: number;
  challenges_total: number;
  participants_completed_challenge: number;
  participants_completed_one_day: number;
  total_enrollments: number;
  total_finalized_days: number;
};

export type AdminChallengeListRow = {
  average_progress: number;
  created_at: string;
  duration_days: number;
  end_date: string | null;
  id: string;
  is_test: boolean;
  name: string;
  participant_count: number;
  slug: string;
  start_date: string | null;
  status: ChallengeStatus;
  total_count: number;
};

export type AdminChallengeDetail = {
  active_participants: number;
  active_window_days: number;
  average_points: number;
  average_progress_percent: number;
  average_streak: number;
  best_streak: number;
  challenge: {
    created_at: string;
    duration_days: number;
    end_date: string | null;
    id: string;
    name: string;
    slug: string;
    start_date: string | null;
    status: ChallengeStatus;
  };
  completed_participants: number;
  completion_rate_percent: number;
  daily_completion: Array<{
    day_number: number;
    finalized_count: number;
    opened_count: number;
  }>;
  enrollment_evolution: Array<{ enrollment_day: string; enrollments: number }>;
  finalized_days: number;
  habit_adherence: Array<{
    adherence_percent: number;
    completed_count: number;
    habit_id: string;
    opportunity_count: number;
    required: boolean;
    title: string;
  }>;
  inactive_participants: number;
  progress_distribution: Array<{
    bucket_label: string;
    bucket_order: number;
    participant_count: number;
  }>;
  total_enrolled: number;
};

export type AdminChallengeFunnelStage = {
  key: string;
  label: string;
  value: number;
};

export type AdminChallengeFunnel = {
  stages: AdminChallengeFunnelStage[];
  abandoned_real: number;
  challenge_id: string;
  challenge_name: string;
  completed_real: number;
  currently_paused: number;
  day1_completed: number;
  day3_completed: number;
  earliest_event_at: string | null;
  global_catalog_views: number;
  halfway_completed_real: number;
  halfway_day: number;
  joins_completed_real: number;
  pause_events: number;
  resume_events: number;
};

export type AdminRetentionDay = {
  day: number;
  eligible: number;
  retained: number;
};

export type AdminChallengeRetention = {
  challenge_id: string;
  d1: AdminRetentionDay;
  d3: AdminRetentionDay;
  d7: AdminRetentionDay;
  halfway: AdminRetentionDay;
};

export type AdminTipsAnalytics = {
  cards: Array<{
    category: string | null;
    content_item_id: string;
    downloads: number;
    opens: number;
    title: string;
    views: number;
  }>;
  categories: Array<{ category: string; views: number }>;
  earliest_event_at: string | null;
  total_downloads: number;
  total_opens: number;
  total_views: number;
};

export type AdminAchievementsAnalytics = {
  achievements: Array<{
    achievement_id: string;
    active: boolean;
    challenge_enrollment_count: number;
    challenge_id: string;
    challenge_name: string;
    download_count: number;
    feed_count: number;
    name: string;
    rarity: string | null;
    share_completed_count: number;
    share_generated_count: number;
    story_count: number;
    unlocked_count: number;
  }>;
  global_share_completed: number;
  global_share_started: number;
};

export type AdminUsersAnalytics = {
  active: number;
  inactive_status: number;
  must_change_password_pending: number;
  onboarding_incomplete: number;
  suspended: number;
  total: number;
  with_active_challenge: number;
  without_active_challenge: number;
};

export type AdminParticipantListRow = {
  activity: "active" | "completed" | "inactive";
  completion_percent: number;
  email: string;
  enrollment_id: string;
  finalized_days: number;
  joined_at: string;
  last_activity_at: string | null;
  name: string | null;
  points_total: number;
  status: EnrollmentStatus;
  streak_best: number;
  streak_current: number;
  total_count: number;
  user_id: string;
};

export type AdminParticipantDetail = {
  achievements: Array<{ icon: string | null; name: string; slug: string; unlocked_at: string }>;
  activity: "active" | "completed" | "inactive";
  challenge_id: string;
  challenge_name: string;
  completed_at: string | null;
  completion_percent: number;
  daily_history: Array<{
    completion_percent: number;
    daily_log_id: string | null;
    day_number: number;
    finalized_at: string | null;
    log_date: string | null;
    points_earned: number | null;
    status: Database["public"]["Enums"]["daily_log_status"] | null;
  }>;
  duration_days: number;
  email: string;
  enrollment_id: string;
  joined_at: string;
  last_activity_at: string | null;
  name: string | null;
  personal_start_date: string;
  points_total: number;
  /**
   * Metadados apenas - nunca o texto do diário (Parte A.2: privacidade do
   * diário reavaliada, admin não lê mais conteúdo, só existência/tamanho).
   */
  reflections:
    | Array<{
        character_count: number;
        has_content: boolean;
        log_date: string;
      }>
    | null;
  reflections_visible: boolean;
  status: EnrollmentStatus;
  streak_best: number;
  streak_current: number;
  user_id: string;
};

function toErrorMessage(error: { code?: string; message: string } | null): string {
  if (!error) {
    return "Não foi possível carregar estes dados agora.";
  }

  if (error.code === "42501") {
    return "Acesso administrativo necessário para consultar estes dados.";
  }

  if (error.code === "P0002") {
    return "Registro não encontrado.";
  }

  return "Não foi possível carregar estes dados agora. Tente novamente em instantes.";
}

export async function getAdminDashboardOverview(): Promise<
  AdminServiceResult<AdminDashboardOverview>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_dashboard_overview");

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminDashboardOverview, error: null };
}

export async function listAdminChallenges(
  params: ChallengeListParams,
): Promise<AdminServiceResult<{ rows: AdminChallengeListRow[]; totalCount: number }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_challenges", {
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: getOffset(params.page),
    p_search: params.search,
    p_sort_by: params.sortBy,
    p_sort_dir: params.sortDir,
    p_status: params.status,
  });

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  const rows = (data ?? []) as AdminChallengeListRow[];

  return {
    data: { rows, totalCount: rows[0]?.total_count ?? 0 },
    error: null,
  };
}

export type TestChallengePurgePreview = {
  challenge_id: string;
  challenge_name: string;
  counts: {
    analytics_events: number;
    daily_logs: number;
    enrollments: number;
    journal_entries: number;
    point_events: number;
  };
};

/**
 * Read-only counts shown in the purge confirmation modal before a
 * super_admin can permanently delete a challenge marked is_test = true.
 * Backed by admin_test_challenge_purge_preview() - re-validates super_admin
 * and is_test server-side, never trusts the row the client already has
 * rendered in the list.
 */
export async function getTestChallengePurgePreview(
  challengeId: string,
): Promise<AdminServiceResult<TestChallengePurgePreview>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_test_challenge_purge_preview", {
    target_challenge_id: challengeId,
  });

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as TestChallengePurgePreview, error: null };
}

export async function getAdminChallengeDetail(
  challengeId: string,
): Promise<AdminServiceResult<AdminChallengeDetail>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_challenge_detail", {
    p_challenge_id: challengeId,
  });

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminChallengeDetail, error: null };
}

export async function getAdminChallengeFunnel(
  challengeId: string,
): Promise<AdminServiceResult<AdminChallengeFunnel>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_challenge_funnel", {
    p_challenge_id: challengeId,
  });

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminChallengeFunnel, error: null };
}

export async function getAdminChallengeRetention(
  challengeId: string,
): Promise<AdminServiceResult<AdminChallengeRetention>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_challenge_retention", {
    p_challenge_id: challengeId,
  });

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminChallengeRetention, error: null };
}

export async function getAdminTipsAnalytics(): Promise<
  AdminServiceResult<AdminTipsAnalytics>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_tips_analytics");

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminTipsAnalytics, error: null };
}

export async function getAdminAchievementsAnalytics(): Promise<
  AdminServiceResult<AdminAchievementsAnalytics>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_achievements_analytics");

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminAchievementsAnalytics, error: null };
}

export async function getAdminUsersAnalytics(): Promise<
  AdminServiceResult<AdminUsersAnalytics>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_users_analytics");

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminUsersAnalytics, error: null };
}

export async function listAdminParticipants(
  challengeId: string,
  params: ParticipantListParams,
): Promise<AdminServiceResult<{ rows: AdminParticipantListRow[]; totalCount: number }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_list_participants", {
    p_activity: params.activity,
    p_challenge_id: challengeId,
    p_limit: ADMIN_PAGE_SIZE,
    p_max_progress: params.maxProgress,
    p_min_progress: params.minProgress,
    p_offset: getOffset(params.page),
    p_search: params.search,
    p_sort_by: params.sortBy,
    p_sort_dir: params.sortDir,
    p_status: params.status,
  });

  if (error) {
    return { data: null, error: toErrorMessage(error) };
  }

  const rows = (data ?? []) as AdminParticipantListRow[];

  return {
    data: { rows, totalCount: rows[0]?.total_count ?? 0 },
    error: null,
  };
}

export async function getAdminParticipantDetail(
  enrollmentId: string,
): Promise<AdminServiceResult<AdminParticipantDetail>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_participant_detail", {
    p_enrollment_id: enrollmentId,
  });

  if (error || !data) {
    return { data: null, error: toErrorMessage(error) };
  }

  return { data: data as unknown as AdminParticipantDetail, error: null };
}

export type { ChallengeStatus, EnrollmentStatus, UserRole };
