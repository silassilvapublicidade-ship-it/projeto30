"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

import { habitIdSchema, habitNotificationFormSchema } from "./habit-notifications.schemas";
import { challengeIdParamSchema } from "./challenge-editor.schemas";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function editorPath(challengeId: string) {
  return `/admin/desafios/${challengeId}/editar`;
}

/**
 * Direct table upsert (RLS: "Admins can manage habit notification config",
 * migration 0054) - same pattern as daily_motivation_messages, no RPC
 * needed since there's no cross-table validation beyond the zod schema
 * itself. unique(habit_id) means one config row per habit at most, so this
 * both creates and edits depending on whether a row already exists.
 */
export async function upsertHabitNotificationConfigAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const habitId = habitIdSchema.parse(formData.get("habitId"));

  const weekdaysRaw = formData.getAll("weekdays");
  const parsed = habitNotificationFormSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    frequencyType: getFormValue(formData, "frequencyType") ?? "weekly",
    monthlyDay: getFormValue(formData, "monthlyDay"),
    notificationBody: getFormValue(formData, "notificationBody") ?? "",
    notificationTime: getFormValue(formData, "notificationTime") ?? "19:00",
    notificationTitle: getFormValue(formData, "notificationTitle") ?? "",
    onlyIfNotCompleted: formData.get("onlyIfNotCompleted") === "on",
    priority: getFormValue(formData, "priority") ?? "5",
    weekdays: weekdaysRaw.map((value) => Number(value)),
  });

  if (!parsed.success) {
    redirect(`${editorPath(challengeId)}?feedback=habit-notification-invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("challenge_habit_notifications").upsert(
    {
      enabled: parsed.data.enabled,
      frequency_type: parsed.data.frequencyType,
      habit_id: habitId,
      monthly_day: parsed.data.frequencyType === "monthly" ? (parsed.data.monthlyDay ?? null) : null,
      notification_body: parsed.data.notificationBody,
      notification_time: parsed.data.notificationTime,
      notification_title: parsed.data.notificationTitle,
      only_if_not_completed: parsed.data.onlyIfNotCompleted,
      priority: parsed.data.priority,
      weekdays: parsed.data.frequencyType === "weekly" ? parsed.data.weekdays : [],
    },
    { onConflict: "habit_id" },
  );

  if (error) {
    redirect(`${editorPath(challengeId)}?feedback=habit-notification-error`);
  }

  redirect(`${editorPath(challengeId)}?feedback=habit-notification-saved`);
}
