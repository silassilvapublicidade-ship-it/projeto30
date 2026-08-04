import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnalyticsEventName =
  | "challenge_catalog_viewed"
  | "challenge_detail_viewed"
  | "challenge_join_clicked"
  | "share_achievement_started"
  | "share_achievement_completed"
  | "tip_card_viewed"
  | "tip_card_opened"
  | "tip_card_downloaded"
  // Modulo F - eventos disparados a partir do cliente (auth.uid() resolve
  // pela sessao normalmente). Eventos disparados pelo processador em lote
  // (notification_sent/failed/campaign_created/campaign_scheduled/
  // notification_scheduled) NAO passam por aqui - ver
  // notification-analytics.service.ts (insert direto via service role).
  | "notification_opened"
  | "notification_read"
  | "notification_clicked"
  | "push_permission_granted"
  | "push_permission_denied"
  | "push_subscription_created"
  | "push_subscription_revoked"
  // Rodada "experiencia diaria" - celebracao de finalizacao.
  | "daily_completion_summary_viewed"
  | "daily_completion_continue_clicked"
  | "daily_completion_journey_clicked"
  | "daily_completion_share_clicked"
  // Dashboard de Evolucao Pessoal (Perfil) - Parte 21. Exatamente os 5
  // eventos pedidos, nenhum dado pessoal no metadata.
  | "profile_dashboard_viewed"
  | "profile_timeline_filter_changed"
  | "profile_challenge_opened"
  | "profile_achievement_shared"
  | "profile_edit_clicked"
  // Dashboard como alma do app / Timeline rica / Compartilhamento premium
  // (Parte F). Nenhum dado pessoal no metadata.
  | "dashboard_mission_opened"
  | "dashboard_continue_day_clicked"
  | "dashboard_next_goal_clicked"
  | "timeline_event_expanded"
  | "evolution_share_started"
  | "evolution_share_completed"
  | "evolution_share_downloaded"
  | "share_template_previewed"
  // Refinamento premium (Parte G) - unico evento genuinamente novo; os
  // demais pedidos no briefing ja existem sob outro nome (ver 0069).
  | "dashboard_context_message_viewed"
  // Cockpit operacional do Admin - unico evento novo (Parte O: nao
  // registrar metricas completas, so a visualizacao da pagina).
  | "admin_overview_viewed";

type RecordAnalyticsEventInput = {
  challengeId?: string | null;
  contentItemId?: string | null;
  enrollmentId?: string | null;
  eventName: AnalyticsEventName;
  metadata?: Record<string, string | number | boolean | null>;
  source?: "server" | "client";
};

/**
 * Best-effort event recording: never throws and never blocks the caller.
 * Analytics is observability, not a product dependency - a failed insert
 * (network hiccup, RLS edge case) must never break a page render or an
 * achievement share flow. All validation (allowed event names, metadata
 * shape/size, ownership of enrollment_id) happens server-side inside
 * public.record_analytics_event() (0015_analytics_events.sql).
 */
export async function recordAnalyticsEvent(input: RecordAnalyticsEventInput): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.rpc("record_analytics_event", {
      p_event_name: input.eventName,
      p_metadata: input.metadata ?? {},
      p_source: input.source ?? "server",
      ...(input.challengeId ? { p_challenge_id: input.challengeId } : {}),
      ...(input.enrollmentId ? { p_enrollment_id: input.enrollmentId } : {}),
      ...(input.contentItemId ? { p_content_item_id: input.contentItemId } : {}),
    });
  } catch {
    // Silenciosamente ignorado - eventos nunca podem quebrar a experiencia.
  }
}
