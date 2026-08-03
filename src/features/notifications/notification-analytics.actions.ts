"use server";

import { recordAnalyticsEvent, type AnalyticsEventName } from "@/server/services/analytics.service";

const CLIENT_TRIGGERED_EVENTS = new Set<AnalyticsEventName>([
  "push_permission_granted",
  "push_permission_denied",
  "push_subscription_created",
  "push_subscription_revoked",
]);

/**
 * Thin client-callable wrapper around the server-only recordAnalyticsEvent
 * - restricted to the 4 push-consent events a client actually needs to
 * fire directly (notification opened/read/clicked already go through
 * mark_notification_* actions, which is a better single source of truth
 * for those). Never throws - same best-effort contract as the underlying
 * service.
 */
export async function recordPushConsentEventAction(eventName: AnalyticsEventName): Promise<void> {
  if (!CLIENT_TRIGGERED_EVENTS.has(eventName)) {
    return;
  }

  await recordAnalyticsEvent({ eventName, source: "client" });
}
