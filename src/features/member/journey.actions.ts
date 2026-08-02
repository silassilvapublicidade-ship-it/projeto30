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

const journalFormSchema = z.object({
  content: z.string().trim().max(2800).optional(),
  dailyLogId: uuidSchema,
  difficulty: z.string().trim().max(1200).optional(),
  gratitude: z.string().trim().max(1200).optional(),
  mood: z.string().trim().max(80).optional(),
  tomorrowFocus: z.string().trim().max(1200).optional(),
  victory: z.string().trim().max(1200).optional(),
});

const finalizeResponseItemSchema = z.object({
  habit_id: uuidSchema,
  note: z.string().trim().max(1200).nullable().optional(),
  status: z.enum(["completed", "not_applicable", "pending"]),
});

const finalizeWithResponsesSchema = z.object({
  dailyLogId: uuidSchema,
  responses: z.array(finalizeResponseItemSchema).max(200),
});

export type FinalizeResponseInput = z.infer<typeof finalizeResponseItemSchema>;

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

/**
 * The user only ever sees a whitelisted, safe message (getSafeJourneyErrorMessage) -
 * this is the only place the real Postgres error (code + message, never any
 * row payload/secret) reaches a log. Without this, an RPC failure like the
 * "Acao nao salva" regression (0030 dropping a not-null column from an
 * INSERT) is invisible server-side and can only be found by manually
 * reproducing the call - exactly what happened before this was added.
 */
function logJourneyRpcFailure(rpcName: string, error: { code?: string; message: string }) {
  console.error(`[journey-rpc-failed] ${rpcName} code=${error.code ?? "unknown"}: ${error.message}`);
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
    logJourneyRpcFailure("save_journal_entry", error);
    redirectWithJourneyNotice("error", getSafeJourneyErrorMessage(error));
  }

  revalidatePath("/app/hoje");
  revalidatePath("/app/jornada");
  redirectWithJourneyNotice("journal");
}

export type FinalizeDaySummary = {
  alreadyFinalized: boolean;
  applicableHabits: number;
  completedHabits: number;
  completionPercent: number;
  dailyLogId: string;
  habitResults: Array<{ habitId: string; status: "completed" | "not_applicable" | "pending" }>;
  pointsEarned: number;
  streakBest: number;
  streakCurrent: number;
  unlockedAchievements: Array<{
    icon: string | null;
    id: string;
    name: string;
    pointsBonus: number;
    slug: string;
    userAchievementId: string;
  }>;
};

export type FinalizeDayActionResult =
  | { message: string; ok: false }
  | { ok: true; summary: FinalizeDaySummary };

type RawFinalizeSummary = {
  already_finalized: boolean;
  applicable_habits: number;
  completed_habits: number;
  completion_percent: number;
  daily_log_id: string;
  habit_results: Array<{ habit_id: string; status: "completed" | "not_applicable" | "pending" }>;
  points_earned: number;
  streak_best: number;
  streak_current: number;
  unlocked_achievements: Array<{
    icon: string | null;
    id: string;
    name: string;
    points_bonus: number;
    slug: string;
    user_achievement_id: string;
  }>;
};

function mapFinalizeSummary(raw: RawFinalizeSummary): FinalizeDaySummary {
  return {
    alreadyFinalized: raw.already_finalized,
    applicableHabits: raw.applicable_habits,
    completedHabits: raw.completed_habits,
    completionPercent: raw.completion_percent,
    dailyLogId: raw.daily_log_id,
    habitResults: raw.habit_results.map((item) => ({ habitId: item.habit_id, status: item.status })),
    pointsEarned: raw.points_earned,
    streakBest: raw.streak_best,
    streakCurrent: raw.streak_current,
    unlockedAchievements: raw.unlocked_achievements.map((achievement) => ({
      icon: achievement.icon,
      id: achievement.id,
      name: achievement.name,
      pointsBonus: achievement.points_bonus,
      slug: achievement.slug,
      userAchievementId: achievement.user_achievement_id,
    })),
  };
}

/**
 * The single save point for the whole day: called only when the member taps
 * "Finalizar o dia" (optionally after confirming the pending-habits modal),
 * never per tap. Every habit response and comment collected in local state
 * (today-local-state.core.ts) is sent together and upserted inside one
 * transactional RPC (finalize_daily_log_with_responses, 0037) - there is no
 * per-habit round trip anywhere in this flow anymore.
 *
 * Deliberately NOT a `(formData: FormData) => void` action bound to
 * `<form action>` like the rest of this file - the caller needs the rich
 * JSON summary (points, habit-by-habit results, unlocked achievements) to
 * render the post-finalize summary, and a redirect-based action can't
 * return that. Still fully a Server Action (`"use server"` file, real
 * auth/ownership checks inside) - just invoked directly from a client event
 * handler instead of a form submission.
 */
export async function finalizeDayWithResponsesAction(
  dailyLogId: string,
  responses: FinalizeResponseInput[],
): Promise<FinalizeDayActionResult> {
  await requireAuthUser("/app/hoje");

  const parsed = finalizeWithResponsesSchema.safeParse({ dailyLogId, responses });

  if (!parsed.success) {
    return { ok: false, message: "Revise suas respostas antes de finalizar novamente." };
  }

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { data, error } = await rpc.rpc<RawFinalizeSummary>("finalize_daily_log_with_responses", {
    responses: parsed.data.responses,
    target_daily_log_id: parsed.data.dailyLogId,
  });

  if (error || !data) {
    logJourneyRpcFailure(
      "finalize_daily_log_with_responses",
      error ?? { message: "RPC returned no data" },
    );

    // Deliberately always this exact copy, not the per-error-code messages
    // getSafeJourneyErrorMessage produces elsewhere - the request is
    // explicit that a failed finalize must always reassure the member their
    // local answers are intact and safe to retry, regardless of which
    // Postgres error caused it.
    return {
      ok: false,
      message: "Não foi possível finalizar o dia. Suas respostas foram mantidas. Tente novamente.",
    };
  }

  revalidatePath("/app/hoje");
  revalidatePath("/app/jornada");
  revalidatePath("/app/conquistas");

  return { ok: true, summary: mapFinalizeSummary(data) };
}
