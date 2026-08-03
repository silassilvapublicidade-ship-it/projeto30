"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";
import { getJourneyRpcClient } from "@/server/services/journey-rpc.service";
import { logRpcFailure } from "@/server/services/rpc-logging.service";

const subscribeSchema = z.object({
  auth: z.string().trim().min(1).max(300),
  deviceName: z.string().trim().max(120).optional(),
  endpoint: z.url().max(2000),
  p256dh: z.string().trim().min(1).max(300),
  platform: z.string().trim().max(60).optional(),
  userAgent: z.string().trim().max(400).optional(),
});

export type PushSubscribeInput = z.input<typeof subscribeSchema>;
export type PushActionResult = { message?: string; ok: boolean };

/**
 * Called only after the browser already granted Notification permission
 * and produced a real PushSubscription - never called speculatively. The
 * RPC (upsert_push_subscription, security definer) reassigns endpoint
 * ownership to the current session's user on conflict, which is also what
 * makes account-switch-on-the-same-device behave correctly (see migration
 * 0041's comment on push_subscriptions_endpoint_key).
 */
export async function subscribePushAction(input: PushSubscribeInput): Promise<PushActionResult> {
  await requireAuthUser("/app/configuracoes/notificacoes");

  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    return { message: "Dados de subscription inválidos.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("upsert_push_subscription", {
    p_auth: parsed.data.auth,
    p_device_name: parsed.data.deviceName,
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_platform: parsed.data.platform,
    p_user_agent: parsed.data.userAgent,
  });

  if (error) {
    logRpcFailure("upsert_push_subscription", error);
    return { message: "Não foi possível salvar a inscrição para notificações push.", ok: false };
  }

  return { ok: true };
}

const endpointSchema = z.url().max(2000);

/**
 * Revokes just the DB link for this one endpoint (this device/browser) -
 * never the browser's own permission or pushManager subscription. Called
 * from the sign-out flow (client reads its own current endpoint first) so
 * a different account signing in on the same device never inherits it.
 */
export async function unsubscribePushAction(endpoint: string): Promise<PushActionResult> {
  await requireAuthUser("/app/configuracoes/notificacoes");

  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) {
    return { message: "Endpoint inválido.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("revoke_push_subscription", { p_endpoint: parsed.data });

  if (error) {
    logRpcFailure("revoke_push_subscription", error);
    return { message: "Não foi possível remover a inscrição.", ok: false };
  }

  return { ok: true };
}
