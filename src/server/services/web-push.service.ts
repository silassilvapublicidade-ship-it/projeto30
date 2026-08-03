import "server-only";

import { sendNotification, WebPushError } from "web-push";

import { getRequiredVapidConfig } from "@/lib/env/server";
import type { NotificationDestinationType } from "@/features/notifications/notification-destination.core";

export type PushPayload = {
  badge?: string;
  body: string;
  campaignId?: string | null;
  deliveryId?: string | null;
  destinationReferenceId?: string | null;
  destinationType: NotificationDestinationType;
  icon?: string;
  image?: string | null;
  notificationId?: string | null;
  tag?: string;
  title: string;
};

export type PushSendResult =
  | { ok: true }
  | { ok: false; permanent: boolean; sanitizedMessage: string; statusCode: number | null };

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

/**
 * Sends one Web Push message via VAPID. Never logs/returns the endpoint,
 * p256dh, auth, or the raw upstream error body - only a statusCode-derived
 * generic message, so retry/failure bookkeeping (notification_deliveries)
 * never accumulates PII. 404/410 are the push service's own "this
 * subscription no longer exists" signal (RFC 8030) - permanent, the caller
 * must revoke the subscription and never retry; anything else is treated
 * as temporary/retryable.
 */
export async function sendWebPush(
  subscription: { auth: string; endpoint: string; p256dh: string },
  payload: PushPayload,
): Promise<PushSendResult> {
  const vapid = getRequiredVapidConfig();

  try {
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      },
      JSON.stringify(payload),
      {
        TTL: DEFAULT_TTL_SECONDS,
        vapidDetails: {
          privateKey: vapid.privateKey,
          publicKey: vapid.publicKey,
          subject: vapid.subject,
        },
      },
    );

    return { ok: true };
  } catch (error) {
    if (error instanceof WebPushError) {
      const permanent = error.statusCode === 404 || error.statusCode === 410;
      return {
        ok: false,
        permanent,
        sanitizedMessage: describeStatusCode(error.statusCode),
        statusCode: error.statusCode,
      };
    }

    return {
      ok: false,
      permanent: false,
      sanitizedMessage: "Falha desconhecida ao enviar push.",
      statusCode: null,
    };
  }
}

function describeStatusCode(statusCode: number): string {
  if (statusCode === 404 || statusCode === 410) {
    return "Subscription nao existe mais no servico de push (404/410).";
  }
  if (statusCode === 413) {
    return "Payload de push excede o tamanho maximo permitido.";
  }
  if (statusCode === 429) {
    return "Servico de push aplicou rate limit (429).";
  }
  if (statusCode >= 500) {
    return `Servico de push indisponivel (${statusCode}).`;
  }
  return `Envio de push rejeitado (${statusCode}).`;
}
