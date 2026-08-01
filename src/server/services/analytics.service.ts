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
  | "tip_card_downloaded";

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
