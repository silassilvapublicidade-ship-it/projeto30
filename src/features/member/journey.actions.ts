"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";
import {
  getJourneyRpcClient,
  getSafeJourneyErrorMessage,
} from "@/server/services/journey-rpc.service";

const uuidSchema = z.uuid();

const habitStatusSchema = z.enum(["pending", "completed", "not_applicable", "skipped"]);

const habitFormSchema = z.object({
  dailyLogId: uuidSchema,
  habitId: uuidSchema,
  note: z.string().trim().max(1200).optional(),
  status: habitStatusSchema,
  value: z.string().trim().optional(),
});

const journalFormSchema = z.object({
  content: z.string().trim().max(2800).optional(),
  dailyLogId: uuidSchema,
  difficulty: z.string().trim().max(1200).optional(),
  gratitude: z.string().trim().max(1200).optional(),
  mood: z.string().trim().max(80).optional(),
  tomorrowFocus: z.string().trim().max(1200).optional(),
  victory: z.string().trim().max(1200).optional(),
});

const finalizeFormSchema = z.object({
  confirm: z.literal("on"),
  dailyLogId: uuidSchema,
});

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalString(formData: FormData, key: string) {
  const value = getString(formData, key).trim();
  return value.length > 0 ? value : undefined;
}

function redirectWithJourneyNotice(
  status: "error" | "finalized" | "habit" | "journal",
  message?: string,
): never {
  const params = new URLSearchParams({ journey: status });

  if (message) {
    params.set("message", message);
  }

  redirect(`/app/hoje?${params.toString()}`);
}

function normalizeNumericValue(value: string | undefined) {
  if (!value) {
    return {};
  }

  const normalized = value.replace(",", ".");
  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("Valor invalido.");
  }

  return { value: numericValue };
}

export async function updateHabitLogAction(formData: FormData) {
  await requireAuthUser("/app/hoje");

  const parsed = habitFormSchema.safeParse({
    dailyLogId: getString(formData, "dailyLogId"),
    habitId: getString(formData, "habitId"),
    note: optionalString(formData, "note"),
    status: getString(formData, "status"),
    value: optionalString(formData, "value"),
  });

  if (!parsed.success) {
    redirectWithJourneyNotice("error", "Revise o habito antes de salvar novamente.");
  }

  let valueJson: Record<string, unknown>;

  try {
    valueJson = normalizeNumericValue(parsed.data.value);
  } catch {
    redirectWithJourneyNotice("error", "Informe um valor numerico valido.");
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("update_habit_log", {
    target_daily_log_id: parsed.data.dailyLogId,
    target_habit_id: parsed.data.habitId,
    target_note: parsed.data.note ?? null,
    target_status: parsed.data.status,
    target_value_json: valueJson,
  });

  if (error) {
    redirectWithJourneyNotice("error", getSafeJourneyErrorMessage(error));
  }

  revalidatePath("/app/hoje");
  revalidatePath("/app/jornada");
  redirectWithJourneyNotice("habit");
}

export async function saveJournalEntryAction(formData: FormData) {
  await requireAuthUser("/app/hoje");

  const parsed = journalFormSchema.safeParse({
    content: optionalString(formData, "content"),
    dailyLogId: getString(formData, "dailyLogId"),
    difficulty: optionalString(formData, "difficulty"),
    gratitude: optionalString(formData, "gratitude"),
    mood: optionalString(formData, "mood"),
    tomorrowFocus: optionalString(formData, "tomorrowFocus"),
    victory: optionalString(formData, "victory"),
  });

  if (!parsed.success) {
    redirectWithJourneyNotice("error", "Revise sua reflexao antes de salvar novamente.");
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("save_journal_entry", {
    target_content: parsed.data.content ?? null,
    target_daily_log_id: parsed.data.dailyLogId,
    target_difficulty: parsed.data.difficulty ?? null,
    target_gratitude: parsed.data.gratitude ?? null,
    target_mood: parsed.data.mood ?? null,
    target_tomorrow_focus: parsed.data.tomorrowFocus ?? null,
    target_victory: parsed.data.victory ?? null,
  });

  if (error) {
    redirectWithJourneyNotice("error", getSafeJourneyErrorMessage(error));
  }

  revalidatePath("/app/hoje");
  revalidatePath("/app/jornada");
  redirectWithJourneyNotice("journal");
}

export async function finalizeDailyLogAction(formData: FormData) {
  await requireAuthUser("/app/hoje");

  const parsed = finalizeFormSchema.safeParse({
    confirm: getString(formData, "confirm"),
    dailyLogId: getString(formData, "dailyLogId"),
  });

  if (!parsed.success) {
    redirectWithJourneyNotice("error", "Confirme a finalizacao antes de fechar o dia.");
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("finalize_daily_log", {
    target_daily_log_id: parsed.data.dailyLogId,
  });

  if (error) {
    redirectWithJourneyNotice("error", getSafeJourneyErrorMessage(error));
  }

  revalidatePath("/app/hoje");
  revalidatePath("/app/jornada");
  revalidatePath("/app/conquistas");
  redirectWithJourneyNotice("finalized");
}
