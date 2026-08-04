"use server";

import type { TimelineEventType } from "@/features/profile/profile-evolution.core";
import type { AnalyticsEventName } from "@/server/services/analytics.service";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { requireAuthUser } from "@/server/services/auth-session.service";
import { getProfileTimeline, type ProfileTimelinePage } from "@/server/services/profile-dashboard.service";

const PROFILE_EVENT_NAMES = [
  "profile_dashboard_viewed",
  "profile_timeline_filter_changed",
  "profile_challenge_opened",
  "profile_achievement_shared",
  "profile_edit_clicked",
] as const satisfies readonly AnalyticsEventName[];

type ProfileEventName = (typeof PROFILE_EVENT_NAMES)[number];

/**
 * Unico ponto de entrada de analytics do dashboard - narrowed aos 5 eventos
 * pedidos (Parte 21), best-effort (recordAnalyticsEvent nunca lanca).
 * Nenhum metadata pessoal e enviado.
 */
export async function recordProfileDashboardEventAction(
  eventName: ProfileEventName,
  options?: { challengeId?: string; enrollmentId?: string },
): Promise<void> {
  if (!PROFILE_EVENT_NAMES.includes(eventName)) {
    return;
  }

  await requireAuthUser("/app/perfil");
  await recordAnalyticsEvent({
    challengeId: options?.challengeId ?? null,
    enrollmentId: options?.enrollmentId ?? null,
    eventName,
    source: "client",
  });
}

/**
 * "Carregar mais" server-side (Parte 8/17) - o cliente so envia o cursor
 * composto + filtro atual, a paginacao real acontece dentro de
 * member_profile_timeline().
 */
export async function loadMoreProfileTimelineAction(input: {
  challengeId?: string;
  cursorAt: string;
  cursorId: string;
  types?: TimelineEventType[];
}): Promise<ProfileTimelinePage> {
  await requireAuthUser("/app/perfil");
  return getProfileTimeline({
    challengeId: input.challengeId,
    cursorAt: input.cursorAt,
    cursorId: input.cursorId,
    types: input.types,
  });
}
