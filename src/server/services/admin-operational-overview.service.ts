import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CockpitPeriod } from "@/features/admin/admin-activity.core";

import type { SystemHealthOverview } from "./system-observability.service";

export type OperationalOverview = {
  period: CockpitPeriod;
  periodStart: string;
  health: SystemHealthOverview;
  metrics: {
    activeUsers: number;
    daysFinalized: number;
    newSignups: number;
    enrollments: number;
    campaignsSent: number;
    notificationsDelivered: number;
    criticalErrors: number;
    warnings: number;
  };
  blocks: {
    currentChallengeName: string | null;
    currentChallengeActiveParticipants: number;
    tipsPublished: number;
    cardsGenerated: number;
  };
  cronNote: string;
};

export async function getAdminOperationalOverview(period: CockpitPeriod): Promise<OperationalOverview> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_operational_overview", { p_period: period });

  if (error || !data) {
    throw new Error(error?.message ?? "Não foi possível carregar o cockpit agora.");
  }

  const raw = data as Record<string, unknown> & {
    metrics: Record<string, unknown>;
  };

  return {
    ...(raw as unknown as OperationalOverview),
    metrics: {
      ...(raw.metrics as OperationalOverview["metrics"]),
      // A RPC devolve criticalErrors/warnings como texto (vieram de um
      // ->> jsonb dentro da própria função) - normaliza para number aqui,
      // uma vez só, em vez de espalhar Number(...) pela UI.
      criticalErrors: Number(raw.metrics.criticalErrors ?? 0),
      warnings: Number(raw.metrics.warnings ?? 0),
    },
  };
}

export type RecentActivityItem = {
  occurred_at: string;
  category: string;
  label: string;
  detail: string | null;
  actor_name: string | null;
  link: string | null;
};

export async function getAdminRecentActivity(limit = 10): Promise<RecentActivityItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_recent_activity", { p_limit: limit });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as RecentActivityItem[];
}
