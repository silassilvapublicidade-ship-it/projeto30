"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";
import { getJourneyRpcClient } from "@/server/services/journey-rpc.service";
import { listMemberNotifications, type MemberNotification } from "@/server/services/notifications.service";
import { logRpcFailure } from "@/server/services/rpc-logging.service";

const notificationIdSchema = z.uuid();

export type NotificationActionResult = { message?: string; ok: boolean };

export async function markNotificationReadAction(notificationId: string): Promise<NotificationActionResult> {
  await requireAuthUser("/app/notificacoes");

  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) {
    return { message: "Identificador inválido.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("mark_notification_read", { p_notification_id: parsed.data });

  if (error) {
    logRpcFailure("mark_notification_read", error);
    return { message: "Não foi possível marcar como lida.", ok: false };
  }

  revalidatePath("/app/notificacoes");
  revalidatePath("/app/hoje");
  return { ok: true };
}

export async function markNotificationOpenedAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  await requireAuthUser("/app/notificacoes");

  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) {
    return { message: "Identificador inválido.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("mark_notification_opened", { p_notification_id: parsed.data });

  if (error) {
    logRpcFailure("mark_notification_opened", error);
    return { message: "Não foi possível registrar a abertura.", ok: false };
  }

  return { ok: true };
}

export async function markNotificationClickedAction(
  notificationId: string,
): Promise<NotificationActionResult> {
  await requireAuthUser("/app/notificacoes");

  const parsed = notificationIdSchema.safeParse(notificationId);
  if (!parsed.success) {
    return { message: "Identificador inválido.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("mark_notification_clicked", { p_notification_id: parsed.data });

  if (error) {
    logRpcFailure("mark_notification_clicked", error);
    return { message: "Não foi possível registrar o clique.", ok: false };
  }

  revalidatePath("/app/notificacoes");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  await requireAuthUser("/app/notificacoes");

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("mark_all_notifications_read", {});

  if (error) {
    logRpcFailure("mark_all_notifications_read", error);
    return { message: "Não foi possível marcar todas como lidas.", ok: false };
  }

  revalidatePath("/app/notificacoes");
  revalidatePath("/app/hoje");
  return { ok: true };
}

export async function loadMoreNotificationsAction(
  cursor: string,
): Promise<{ hasMore: boolean; notifications: MemberNotification[] }> {
  await requireAuthUser("/app/notificacoes");
  return listMemberNotifications({ cursor });
}
