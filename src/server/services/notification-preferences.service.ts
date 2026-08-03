import "server-only";

import {
  NOTIFICATION_PREFERENCES_DEFAULTS,
  type NotificationPreferencesJson,
} from "@/features/notifications/notification-preferences.schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { requireAuthUser } from "./auth-session.service";

export type MemberNotificationPreferences = {
  notifications: NotificationPreferencesJson;
  reminderTime: string | null;
  timezone: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeNotificationDefaults(raw: unknown): NotificationPreferencesJson {
  const record = asRecord(raw);
  return { ...NOTIFICATION_PREFERENCES_DEFAULTS, ...record } as NotificationPreferencesJson;
}

export async function getMemberNotificationPreferences(): Promise<MemberNotificationPreferences> {
  const user = await requireAuthUser("/app/configuracoes/notificacoes");
  const supabase = await createSupabaseServerClient();

  const [{ data: preferences }, { data: profile }] = await Promise.all([
    supabase.from("user_preferences").select("notifications, reminder_time").eq("user_id", user.id).maybeSingle(),
    supabase.from("users").select("timezone").eq("id", user.id).maybeSingle(),
  ]);

  return {
    notifications: mergeNotificationDefaults(preferences?.notifications),
    reminderTime: preferences?.reminder_time ?? null,
    timezone: profile?.timezone || "America/Sao_Paulo",
  };
}
