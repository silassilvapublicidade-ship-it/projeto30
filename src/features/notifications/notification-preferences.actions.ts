"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";

import { notificationPreferencesFormSchema } from "./notification-preferences.schemas";

export type SavePreferencesResult = { message?: string; ok: boolean };

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Writes via the session-scoped client (not service-role) - RLS's
 * "Users can manage own preferences" policy (user_id = auth.uid()) already
 * covers this, same as everywhere else non-admin mutations don't strictly
 * need a table-specific RPC. Merges over the existing notifications jsonb
 * so pre-existing keys (email/in_app/communication_opt_in, set during
 * onboarding) are never dropped.
 */
export async function saveNotificationPreferencesAction(
  formData: FormData,
): Promise<SavePreferencesResult> {
  const user = await requireAuthUser("/app/configuracoes/notificacoes");

  const parsed = notificationPreferencesFormSchema.safeParse({
    achievementNotifications: formData.get("achievementNotifications") === "on",
    adminCampaignNotifications: formData.get("adminCampaignNotifications") === "on",
    challengeStartNotifications: formData.get("challengeStartNotifications") === "on",
    dailyMotivationEnabled: formData.get("dailyMotivationEnabled") === "on",
    dailyReminderEnabled: formData.get("dailyReminderEnabled") === "on",
    dailyReminderTime: formData.get("dailyReminderTime") || undefined,
    faithMessagesEnabled: formData.get("faithMessagesEnabled") === "on",
    habitRemindersEnabled: formData.get("habitRemindersEnabled") === "on",
    importantUpdatesNotifications: formData.get("importantUpdatesNotifications") === "on",
    newTipNotifications: formData.get("newTipNotifications") === "on",
    pushEnabled: formData.get("pushEnabled") === "on",
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Revise as preferências antes de salvar.",
      ok: false,
    };
  }

  if (parsed.data.dailyReminderEnabled && !parsed.data.dailyReminderTime) {
    return { message: "Escolha um horário para o lembrete diário.", ok: false };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("user_preferences")
    .select("notifications")
    .eq("user_id", user.id)
    .maybeSingle();

  const notifications = {
    ...asRecord(existing?.notifications),
    achievement_notifications: parsed.data.achievementNotifications,
    admin_campaign_notifications: parsed.data.adminCampaignNotifications,
    challenge_start_notifications: parsed.data.challengeStartNotifications,
    daily_motivation_enabled: parsed.data.dailyMotivationEnabled,
    daily_reminder_enabled: parsed.data.dailyReminderEnabled,
    faith_messages_enabled: parsed.data.faithMessagesEnabled,
    habit_reminders_enabled: parsed.data.habitRemindersEnabled,
    important_updates_notifications: parsed.data.importantUpdatesNotifications,
    new_tip_notifications: parsed.data.newTipNotifications,
    push_enabled: parsed.data.pushEnabled,
  };

  const { error } = await supabase.from("user_preferences").upsert({
    notifications,
    reminder_time: (parsed.data.dailyReminderEnabled ? parsed.data.dailyReminderTime : null) ?? null,
    user_id: user.id,
  });

  if (error) {
    return { message: "Não foi possível salvar suas preferências agora.", ok: false };
  }

  revalidatePath("/app/configuracoes/notificacoes");
  return { ok: true };
}

/**
 * Tiny dedicated action for just the push_enabled flag - called right
 * after a successful browser subscribe (see push-notification-opt-in.tsx)
 * so the user doesn't have to separately submit the full preferences form
 * to confirm what they just did by clicking "Ativar notificações". The
 * full form (saveNotificationPreferencesAction) can still flip it back off
 * independently.
 */
export async function setPushEnabledAction(enabled: boolean): Promise<SavePreferencesResult> {
  const user = await requireAuthUser("/app/configuracoes/notificacoes");
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("user_preferences")
    .select("notifications")
    .eq("user_id", user.id)
    .maybeSingle();

  const notifications = { ...asRecord(existing?.notifications), push_enabled: enabled };

  const { error } = await supabase.from("user_preferences").upsert({ notifications, user_id: user.id });

  if (error) {
    return { message: "Não foi possível salvar a preferência de push.", ok: false };
  }

  revalidatePath("/app/configuracoes/notificacoes");
  return { ok: true };
}

/**
 * Separate, tiny action just for the timezone field (settable from the
 * same preferences page) - onboarding already collects it once, this lets
 * a user correct it later without resubmitting the whole notifications
 * form.
 */
export async function updateNotificationTimezoneAction(timezone: string): Promise<SavePreferencesResult> {
  const user = await requireAuthUser("/app/configuracoes/notificacoes");

  const trimmed = timezone.trim();
  if (!trimmed || trimmed.length > 100) {
    return { message: "Fuso horário inválido.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("users").update({ timezone: trimmed }).eq("id", user.id);

  if (error) {
    return { message: "Não foi possível atualizar o fuso horário.", ok: false };
  }

  revalidatePath("/app/configuracoes/notificacoes");
  return { ok: true };
}
