import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import type { NotificationAudienceType } from "@/features/admin/notification-campaigns.schemas";
import type { NotificationDestinationType } from "@/features/notifications/notification-destination.core";

import { listAdminUsers } from "./admin-users.service";

export type AdminServiceResult<T> = { data: T; error: null } | { data: null; error: string };

function toErrorMessage(error: { message?: string } | null): string {
  return error?.message ?? "Erro inesperado.";
}

function logUnexpectedFailure(operation: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ADMIN_NOTIFICATION_CAMPAIGNS_FAILED] ${operation}:`, message);
  return "Não foi possível carregar os dados agora. Tente novamente em alguns segundos.";
}

export type CampaignStatus = Database["public"]["Tables"]["notification_campaigns"]["Row"]["status"];

export type AdminNotificationCampaignRow = {
  audience_estimated_count: number | null;
  audience_type: string;
  channel_internal: boolean;
  channel_push: boolean;
  clicked_count: number;
  completed_at: string | null;
  created_at: string;
  created_by_name: string | null;
  delivered_count: number;
  failed_count: number;
  id: string;
  opened_count: number;
  scheduled_for: string | null;
  sent_count: number;
  source: string;
  status: CampaignStatus;
  title: string;
  total_recipients: number;
};

export const ADMIN_NOTIFICATION_CAMPAIGN_PAGE_SIZE = 20;

export type AdminNotificationCampaignListParams = {
  page?: number | undefined;
  search?: string | undefined;
  sortBy?: "created_at" | "scheduled_for" | "status" | "title" | undefined;
  sortDir?: "asc" | "desc" | undefined;
  status?: string | undefined;
};

export async function listAdminNotificationCampaigns(
  params: AdminNotificationCampaignListParams = {},
): Promise<AdminServiceResult<{ rows: AdminNotificationCampaignRow[]; totalCount: number }>> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * ADMIN_NOTIFICATION_CAMPAIGN_PAGE_SIZE;

  try {
    const { data, error } = await supabase.rpc("admin_list_notification_campaigns", {
      p_limit: ADMIN_NOTIFICATION_CAMPAIGN_PAGE_SIZE,
      p_offset: offset,
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
          audience_estimated_count: row.audience_estimated_count,
          audience_type: row.audience_type,
          channel_internal: row.channel_internal,
          channel_push: row.channel_push,
          clicked_count: row.clicked_count,
          completed_at: row.completed_at,
          created_at: row.created_at,
          created_by_name: row.created_by_name,
          delivered_count: row.delivered_count,
          failed_count: row.failed_count,
          id: row.id,
          opened_count: row.opened_count,
          scheduled_for: row.scheduled_for,
          sent_count: row.sent_count,
          source: row.source,
          status: row.status as CampaignStatus,
          title: row.title,
          total_recipients: row.total_recipients,
        })),
        totalCount: rows[0]?.total_count ?? 0,
      },
      error: null,
    };
  } catch (caughtError) {
    return { data: null, error: logUnexpectedFailure("listAdminNotificationCampaigns", caughtError) };
  }
}

export type AdminNotificationCampaignDetail = {
  action_label: string | null;
  audience_estimated_count: number | null;
  audience_type: NotificationAudienceType;
  automation_type: string | null;
  challenge_id: string | null;
  channel_internal: boolean;
  channel_push: boolean;
  completed_at: string | null;
  created_at: string;
  created_by_name: string | null;
  destination_reference_id: string | null;
  destination_type: NotificationDestinationType;
  failures: { failure_code: string | null; retry_count: number; user_id: string }[];
  habit_keyword: string | null;
  id: string;
  image_url: string | null;
  message: string;
  metrics: {
    cancelled_count: number;
    clicked_count: number;
    failed_count: number;
    opened_count: number;
    pending_count: number;
    read_count: number;
    sent_count: number;
    total_recipients: number;
  };
  min_streak_threshold: number | null;
  scheduled_for: string | null;
  source: string;
  specific_user_id: string | null;
  started_at: string | null;
  status: CampaignStatus;
  title: string;
};

export async function getAdminNotificationCampaign(
  campaignId: string,
): Promise<AdminServiceResult<AdminNotificationCampaignDetail>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_get_notification_campaign", {
      p_campaign_id: campaignId,
    });

    if (error) {
      return { data: null, error: toErrorMessage(error) };
    }

    return { data: data as unknown as AdminNotificationCampaignDetail, error: null };
  } catch (caughtError) {
    return { data: null, error: logUnexpectedFailure("getAdminNotificationCampaign", caughtError) };
  }
}

export type NotificationCampaignPeriodSummary = {
  campaignsSent: number;
  notificationsClicked: number;
  notificationsFailed: number;
  notificationsOpened: number;
  notificationsSent: number;
};

/** Parte 12 "graficos por periodo" - uma unica agregacao no banco (nunca
 * N+1 de contagens separadas), sem biblioteca de graficos. */
export async function getNotificationCampaignPeriodSummary(
  days = 30,
): Promise<NotificationCampaignPeriodSummary> {
  const empty: NotificationCampaignPeriodSummary = {
    campaignsSent: 0,
    notificationsClicked: 0,
    notificationsFailed: 0,
    notificationsOpened: 0,
    notificationsSent: 0,
  };

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("admin_notification_campaign_period_summary", {
      p_days: days,
    });

    if (error || !data || typeof data !== "object") {
      return empty;
    }

    const result = data as Record<string, number>;
    return {
      campaignsSent: result.campaigns_sent ?? 0,
      notificationsClicked: result.notifications_clicked ?? 0,
      notificationsFailed: result.notifications_failed ?? 0,
      notificationsOpened: result.notifications_opened ?? 0,
      notificationsSent: result.notifications_sent ?? 0,
    };
  } catch (caughtError) {
    logUnexpectedFailure("getNotificationCampaignPeriodSummary", caughtError);
    return empty;
  }
}

export type ChallengeOption = { id: string; name: string };

/** Any status (not just active) - a broadcast to past participants of an
 * already-ended challenge is a legitimate admin use case. */
export async function listChallengesForNotificationPicker(): Promise<ChallengeOption[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("challenges")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      logUnexpectedFailure("listChallengesForNotificationPicker", error);
      return [];
    }

    return data ?? [];
  } catch (caughtError) {
    logUnexpectedFailure("listChallengesForNotificationPicker", caughtError);
    return [];
  }
}

export type UserOption = { display_name: string | null; email: string; id: string };

/** Prefill helper for the edit form's "specific_user" picker - the detail
 * RPC only returns the id, never the full user row, so this is a single
 * targeted lookup rather than exposing a wider user query to the client. */
export async function getNotificationUserById(userId: string): Promise<UserOption | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, display_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (caughtError) {
    logUnexpectedFailure("getNotificationUserById", caughtError);
    return null;
  }
}

/**
 * Reuses admin_list_users (the same RPC /admin/usuarios already calls) for
 * the "specific_user" audience picker instead of a new query - it already
 * does name/email search safely (server-side %L-quoted ILIKE), so this adds
 * no new search surface. Capped at 20 results, never a full user dump.
 */
export async function searchUsersForNotificationPicker(search: string): Promise<UserOption[]> {
  const trimmed = search.trim();

  if (trimmed.length < 2) {
    return [];
  }

  const { data } = await listAdminUsers({ page: 1, search: trimmed });

  return (data?.rows ?? []).slice(0, 20).map((row) => ({
    display_name: row.display_name,
    email: row.email,
    id: row.id,
  }));
}
