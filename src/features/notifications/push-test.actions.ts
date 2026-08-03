"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";
import {
  recordPushFailure,
  recordPushSuccess,
} from "@/server/services/push-subscription.service";
import { sendWebPush } from "@/server/services/web-push.service";

export type SendTestPushResult = { message: string; ok: boolean };

/**
 * Sends a real push to every active subscription the CURRENT user owns -
 * used only from the notifications settings page ("Enviar notificação de
 * teste"), never targets anyone else. Exists so VAPID/web-push wiring can
 * be validated end-to-end before the full campaign/delivery pipeline
 * (Rodada F2) exists - reuses the exact same sendWebPush + success/failure
 * bookkeeping that pipeline will use, so this isn't throwaway code.
 */
export async function sendTestPushToSelfAction(): Promise<SendTestPushResult> {
  const user = await requireAuthUser("/app/configuracoes/notificacoes");
  const supabase = await createSupabaseServerClient();

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (error) {
    return { message: "Não foi possível carregar sua subscription.", ok: false };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { message: "Nenhuma subscription ativa neste dispositivo.", ok: false };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { message: "Configuração segura do servidor indisponível.", ok: false };
  }

  let successCount = 0;
  let lastFailureMessage: string | null = null;

  for (const subscription of subscriptions) {
    try {
      const result = await sendWebPush(
        { auth: subscription.auth, endpoint: subscription.endpoint, p256dh: subscription.p256dh },
        {
          body: "Se você está vendo isso, o envio push está funcionando de ponta a ponta.",
          destinationType: "notificacoes",
          tag: "p30-test-push",
          title: "Notificação de teste",
        },
      );

      if (result.ok) {
        successCount += 1;
        await recordPushSuccess(admin, subscription.id);
      } else {
        lastFailureMessage = result.sanitizedMessage;
        await recordPushFailure(admin, subscription.id, { permanent: result.permanent });
      }
    } catch {
      lastFailureMessage = "Falha inesperada ao enviar.";
    }
  }

  if (successCount > 0) {
    return { message: `Enviado para ${successCount} dispositivo(s).`, ok: true };
  }

  return { message: lastFailureMessage ?? "Não foi possível enviar.", ok: false };
}
