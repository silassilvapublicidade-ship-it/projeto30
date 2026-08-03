import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { NotificationDestinationType } from "@/features/notifications/notification-destination.core";
import type { Database } from "@/types/database";

import { sendWebPush } from "./web-push.service";
import { logRpcFailure } from "./rpc-logging.service";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type CampaignRow = Database["public"]["Tables"]["notification_campaigns"]["Row"];
type DeliveryRow = Database["public"]["Tables"]["notification_deliveries"]["Row"];

const DISPATCH_BATCH_SIZE = 200;
const MAX_PUSH_RETRIES = 5;
// Exponential-ish backoff by attempt number (minutes), capped at 4h - the
// only retry loop in the system, driven entirely by next_retry_at, never a
// setTimeout/queue this serverless deployment doesn't have.
const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240];

/**
 * One row per (campaign, user) - created (or fetched, if it already exists
 * from a previous, possibly-interrupted run) before any side effect, so a
 * cron re-invocation or a retried request can never double-insert the
 * internal notification or double-send the push for the same recipient.
 */
async function getOrCreateDelivery(
  supabase: AdminClient,
  campaignId: string,
  userId: string,
): Promise<DeliveryRow | null> {
  const idempotencyKey = `${campaignId}:${userId}`;

  await supabase.from("notification_deliveries").upsert(
    { campaign_id: campaignId, idempotency_key: idempotencyKey, user_id: userId },
    { ignoreDuplicates: true, onConflict: "campaign_id,user_id" },
  );

  const { data } = await supabase
    .from("notification_deliveries")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

async function insertInternalNotification(
  supabase: AdminClient,
  campaign: CampaignRow,
  delivery: DeliveryRow,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      action_label: campaign.action_label,
      body: campaign.message,
      campaign_id: campaign.id,
      channel: "in_app",
      delivery_id: delivery.id,
      destination_reference_id: campaign.destination_reference_id,
      destination_type: campaign.destination_type,
      image_url: campaign.image_url,
      sent_at: new Date().toISOString(),
      status: "sent",
      title: campaign.title,
      type: campaign.source === "automation" ? (campaign.automation_type ?? "automation") : "campaign",
      user_id: delivery.user_id,
    })
    .select("id")
    .single();

  if (error || !data) {
    logRpcFailure("insert notifications (campaign dispatch)", error ?? { message: "insert returned no row" });
    return null;
  }

  return data.id;
}

type PushOutcome = "permanent_failure" | "sent" | "temporary_failure" | "unavailable";

async function attemptPush(
  supabase: AdminClient,
  campaign: CampaignRow,
  delivery: DeliveryRow,
  internalNotificationId: string | null,
): Promise<{ message: string | null; outcome: PushOutcome }> {
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", delivery.user_id)
    .is("revoked_at", null);

  if (!subscriptions || subscriptions.length === 0) {
    return { message: null, outcome: "unavailable" };
  }

  let anySucceeded = false;
  let anyTemporaryFailure = false;
  let lastMessage: string | null = null;

  for (const subscription of subscriptions) {
    const result = await sendWebPush(
      { auth: subscription.auth, endpoint: subscription.endpoint, p256dh: subscription.p256dh },
      {
        body: campaign.message,
        campaignId: campaign.id,
        deliveryId: delivery.id,
        destinationReferenceId: campaign.destination_reference_id,
        destinationType: campaign.destination_type as NotificationDestinationType,
        image: campaign.image_url,
        notificationId: internalNotificationId,
        title: campaign.title,
      },
    );

    if (result.ok) {
      anySucceeded = true;
      await supabase
        .from("push_subscriptions")
        .update({ failure_count: 0, last_success_at: new Date().toISOString() })
        .eq("id", subscription.id);
    } else if (result.permanent) {
      // 404/410 - the push service itself says this endpoint is gone.
      // Revoke immediately, never retry (per the briefing's explicit rule).
      await supabase
        .from("push_subscriptions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", subscription.id);
    } else {
      anyTemporaryFailure = true;
      lastMessage = result.sanitizedMessage;
      await supabase
        .from("push_subscriptions")
        .update({
          failure_count: (subscription.failure_count ?? 0) + 1,
          last_failure_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
    }
  }

  if (anySucceeded) {
    return { message: null, outcome: "sent" };
  }

  return anyTemporaryFailure
    ? { message: lastMessage, outcome: "temporary_failure" }
    : { message: null, outcome: "permanent_failure" };
}

/** Runs the push attempt (if applicable) for a delivery whose internal
 * notification (if requested) is already guaranteed present, and writes the
 * resulting status/retry bookkeeping. Shared by the first-pass dispatch and
 * the later retry pass - the only two callers that ever touch push state. */
async function resolveDeliveryOutcome(
  supabase: AdminClient,
  campaign: CampaignRow,
  delivery: DeliveryRow,
  pushEligible: boolean,
  internalNotificationId: string | null,
): Promise<"failed" | "pending" | "sent"> {
  const pushRequested = campaign.channel_push && pushEligible;

  if (!pushRequested) {
    await supabase
      .from("notification_deliveries")
      .update({ sent_at: new Date().toISOString(), status: "sent" })
      .eq("id", delivery.id);
    return "sent";
  }

  const { message, outcome } = await attemptPush(supabase, campaign, delivery, internalNotificationId);

  if (outcome === "sent") {
    await supabase
      .from("notification_deliveries")
      .update({ failure_code: null, failure_message: null, sent_at: new Date().toISOString(), status: "sent" })
      .eq("id", delivery.id);
    return "sent";
  }

  if (outcome === "permanent_failure" || outcome === "unavailable") {
    // Push is a dead end for this user (revoked/no subscription), but the
    // internal channel already delivered if it was requested - that's a
    // success for the campaign as a whole, per "mesmo sem push o usuario
    // continua recebendo notificacoes internas".
    const status = campaign.channel_internal ? "sent" : "failed";
    await supabase
      .from("notification_deliveries")
      .update({
        failed_at: status === "failed" ? new Date().toISOString() : null,
        failure_code: "push_unavailable",
        failure_message: message,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        status,
      })
      .eq("id", delivery.id);
    return status;
  }

  // temporary_failure
  const nextRetryCount = delivery.retry_count + 1;

  if (nextRetryCount >= MAX_PUSH_RETRIES) {
    const status = campaign.channel_internal ? "sent" : "failed";
    await supabase
      .from("notification_deliveries")
      .update({
        failed_at: status === "failed" ? new Date().toISOString() : null,
        failure_code: "push_retries_exhausted",
        failure_message: message,
        next_retry_at: null,
        retry_count: nextRetryCount,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        status,
      })
      .eq("id", delivery.id);
    return status;
  }

  const backoffMinutes =
    RETRY_BACKOFF_MINUTES[Math.min(nextRetryCount - 1, RETRY_BACKOFF_MINUTES.length - 1)] ??
    RETRY_BACKOFF_MINUTES[RETRY_BACKOFF_MINUTES.length - 1] ??
    240;

  await supabase
    .from("notification_deliveries")
    .update({
      failure_code: "push_temporary_failure",
      failure_message: message,
      next_retry_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
      retry_count: nextRetryCount,
      status: "pending",
    })
    .eq("id", delivery.id);
  return "pending";
}

async function dispatchToUser(
  supabase: AdminClient,
  campaign: CampaignRow,
  userId: string,
  pushEligible: boolean,
): Promise<"failed" | "pending" | "sent"> {
  const delivery = await getOrCreateDelivery(supabase, campaign.id, userId);

  if (!delivery) {
    return "failed";
  }

  // Already resolved in an earlier run (idempotent no-op) - never re-insert
  // the internal notification or re-send the push for a finished delivery.
  if (["cancelled", "clicked", "delivered", "failed", "opened", "read", "sent"].includes(delivery.status)) {
    return delivery.status === "failed" ? "failed" : "sent";
  }

  let internalNotificationId = delivery.internal_notification_id;

  if (campaign.channel_internal && !internalNotificationId) {
    internalNotificationId = await insertInternalNotification(supabase, campaign, delivery);

    if (!internalNotificationId) {
      await supabase
        .from("notification_deliveries")
        .update({
          failed_at: new Date().toISOString(),
          failure_code: "internal_insert_failed",
          status: "failed",
        })
        .eq("id", delivery.id);
      return "failed";
    }

    await supabase
      .from("notification_deliveries")
      .update({ internal_notification_id: internalNotificationId })
      .eq("id", delivery.id);
  }

  return resolveDeliveryOutcome(supabase, campaign, delivery, pushEligible, internalNotificationId);
}

async function finalizeCampaignIfDone(supabase: AdminClient, campaignId: string): Promise<void> {
  const { data: deliveries } = await supabase
    .from("notification_deliveries")
    .select("status")
    .eq("campaign_id", campaignId);

  if (!deliveries || deliveries.length === 0) {
    return;
  }

  if (deliveries.some((row) => row.status === "pending")) {
    return; // retries still outstanding - campaign stays "processing"
  }

  const failedCount = deliveries.filter((row) => row.status === "failed").length;
  const finalStatus =
    failedCount === 0 ? "sent" : failedCount === deliveries.length ? "failed" : "partially_failed";

  await supabase
    .from("notification_campaigns")
    .update({ completed_at: new Date().toISOString(), status: finalStatus })
    .eq("id", campaignId)
    .eq("status", "processing");
}

export type AudienceEntry = { push_eligible: boolean; user_id: string };

/**
 * The shared "engine" every source (admin compositor, cron-scheduled
 * campaigns, and every automation) funnels through once a campaign
 * row exists and an audience has been resolved - the only thing that ever
 * differs between an admin broadcast and an automation is HOW the audience
 * list was built (generic segmentation vs. a business-rule query), never
 * how it's dispatched, retried or how the campaign is finalized.
 */
export async function dispatchCampaignToAudience(
  campaignId: string,
  audience: AudienceEntry[],
  options: { finalize?: boolean } = {},
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: campaign } = await supabase
    .from("notification_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  // Automation campaigns are re-dispatched on every cron tick while their
  // qualifying window is open (e.g. the daily reminder's 07:00-22:00) and
  // deliberately never gated on status==='processing' here - a straggler
  // who becomes eligible mid-window must still get delivered even after an
  // earlier tick already finalized the campaign as 'sent' for the users
  // known at that time. Admin (source='admin') campaigns keep the strict
  // gate: they only ever run once, right after being flipped to processing.
  if (!campaign || (campaign.source === "admin" && campaign.status !== "processing")) {
    return;
  }

  for (let index = 0; index < audience.length; index += DISPATCH_BATCH_SIZE) {
    const batch = audience.slice(index, index + DISPATCH_BATCH_SIZE);
    await Promise.allSettled(
      batch.map((entry) => dispatchToUser(supabase, campaign, entry.user_id, entry.push_eligible)),
    );
  }

  if (options.finalize ?? true) {
    await finalizeCampaignIfDone(supabase, campaignId);
  }
}

/**
 * Entry point for both "enviar agora" (called synchronously right after the
 * admin_start_notification_campaign_now RPC) and the cron route (for
 * admin-composed campaigns whose scheduled_for has arrived). Resolves the
 * audience through the exact same resolve_notification_audience the
 * compositor's live estimate uses, so the real send can never target more
 * or fewer people than what the admin was shown.
 */
export async function processNotificationCampaign(campaignId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: campaign } = await supabase
    .from("notification_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaign || campaign.status !== "processing") {
    return;
  }

  // resolve_notification_audience_combined, never the base resolver
  // directly - min_streak_threshold/habit_keyword (Modulo G, Parte 11) must
  // apply the exact same way here as in the compositor's live estimate
  // (admin_estimate_notification_audience calls the same combined wrapper),
  // so the real send can never diverge from what the admin was shown.
  const { data: audience, error: audienceError } = await supabase.rpc("resolve_notification_audience_combined", {
    p_audience_type: campaign.audience_type,
    p_challenge_id: campaign.challenge_id ?? undefined,
    p_combined_min_streak: campaign.min_streak_threshold ?? undefined,
    p_habit_keyword: campaign.habit_keyword ?? undefined,
    p_min_streak: campaign.min_streak_threshold ?? undefined,
    p_specific_user_id: campaign.specific_user_id ?? undefined,
  });

  if (audienceError || !audience) {
    logRpcFailure("resolve_notification_audience_combined", audienceError ?? { message: "no audience returned" });
    await supabase
      .from("notification_campaigns")
      .update({ completed_at: new Date().toISOString(), status: "failed" })
      .eq("id", campaignId);
    return;
  }

  await dispatchCampaignToAudience(campaignId, audience);
}

/**
 * Picks up notification_deliveries stuck in "pending" whose next_retry_at
 * has arrived (temporary push failures only - internal-only deliveries
 * never enter this state) and retries just the push side. Called by the
 * cron route on every invocation, after new-campaign dispatch.
 */
export async function retryDueNotificationDeliveries(): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: dueDeliveries } = await supabase
    .from("notification_deliveries")
    .select("*, notification_campaigns(*)")
    .eq("status", "pending")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .limit(500);

  if (!dueDeliveries || dueDeliveries.length === 0) {
    return;
  }

  const affectedCampaignIds = new Set<string>();

  for (const row of dueDeliveries) {
    const campaign = row.notification_campaigns as CampaignRow | null;

    if (!campaign) {
      continue;
    }

    affectedCampaignIds.add(campaign.id);
    // pushEligible is always true here - a delivery only reaches "pending"
    // with a next_retry_at when the first attempt already found push
    // requested+eligible and hit a temporary failure.
    await resolveDeliveryOutcome(supabase, campaign, row, true, row.internal_notification_id);
  }

  for (const campaignId of affectedCampaignIds) {
    await finalizeCampaignIfDone(supabase, campaignId);
  }
}

/**
 * Flips due scheduled campaigns (source=admin or automation) to processing
 * and dispatches them - the single place scheduling actually executes, so
 * it works with zero browser open, driven only by the cron route.
 */
export async function processDueScheduledCampaigns(): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: due } = await supabase
    .from("notification_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .limit(100);

  if (!due || due.length === 0) {
    return;
  }

  for (const { id } of due) {
    const { error } = await supabase
      .from("notification_campaigns")
      .update({ started_at: new Date().toISOString(), status: "processing" })
      .eq("id", id)
      .eq("status", "scheduled");

    if (!error) {
      await processNotificationCampaign(id);
    }
  }
}
