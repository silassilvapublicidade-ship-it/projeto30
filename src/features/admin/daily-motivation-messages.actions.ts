"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

import {
  dailyMotivationMessageFormSchema,
  dailyMotivationMessageIdSchema,
} from "./daily-motivation-messages.schemas";

const LIST_PATH = "/admin/notificacoes/motivacionais";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseMessageForm(formData: FormData) {
  return dailyMotivationMessageFormSchema.safeParse({
    active: formData.get("active") === "on",
    body: getFormValue(formData, "body") ?? "",
    category: getFormValue(formData, "category"),
    endsAt: getFormValue(formData, "endsAt"),
    priority: getFormValue(formData, "priority") ?? "5",
    startsAt: getFormValue(formData, "startsAt"),
    title: getFormValue(formData, "title") ?? "",
  });
}

export async function createDailyMotivationMessageAction(formData: FormData) {
  await requireAdminUser();

  const parsed = parseMessageForm(formData);

  if (!parsed.success) {
    redirect(`${LIST_PATH}?feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("daily_motivation_messages").insert({
    active: parsed.data.active,
    body: parsed.data.body,
    category: parsed.data.category,
    ends_at: parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null,
    priority: parsed.data.priority,
    starts_at: parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null,
    title: parsed.data.title,
  });

  if (error) {
    redirect(`${LIST_PATH}?feedback=error`);
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}?feedback=create-success`);
}

export async function updateDailyMotivationMessageAction(formData: FormData) {
  await requireAdminUser();

  const messageId = dailyMotivationMessageIdSchema.parse(formData.get("messageId"));
  const parsed = parseMessageForm(formData);

  if (!parsed.success) {
    redirect(`${LIST_PATH}?feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("daily_motivation_messages")
    .update({
      active: parsed.data.active,
      body: parsed.data.body,
      category: parsed.data.category,
      ends_at: parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null,
      priority: parsed.data.priority,
      starts_at: parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null,
      title: parsed.data.title,
    })
    .eq("id", messageId);

  if (error) {
    redirect(`${LIST_PATH}?feedback=error`);
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}?feedback=update-success`);
}

export async function deleteDailyMotivationMessageAction(formData: FormData) {
  await requireAdminUser();

  const messageId = dailyMotivationMessageIdSchema.parse(formData.get("messageId"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("daily_motivation_messages").delete().eq("id", messageId);

  if (error) {
    redirect(`${LIST_PATH}?feedback=error`);
  }

  revalidatePath(LIST_PATH);
  redirect(`${LIST_PATH}?feedback=delete-success`);
}
