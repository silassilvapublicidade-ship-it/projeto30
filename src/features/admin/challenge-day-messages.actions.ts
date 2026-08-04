"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

import { sanitizeDayMessage } from "./challenge-editor.core";
import {
  challengeDayMessageRangeSchema,
  challengeDayMessageSchema,
  challengeIdParamSchema,
} from "./challenge-editor.schemas";

function editorPath(challengeId: string) {
  return `/admin/desafios/${challengeId}/editar`;
}

function redirectWithFeedback(challengeId: string, feedback: string): never {
  redirect(`${editorPath(challengeId)}?feedback=${feedback}#mensagens-do-ciclo`);
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Todo escritor de challenge_days.message revalida as telas onde essa
 * mensagem realmente aparece (Correções obrigatórias pré-lançamento, Parte
 * D) - nunca so a propria tela do editor. member_profile_overview e as
 * leituras de getMemberContext() ja sao dinamicas por sessao (nunca cache
 * estatico de pagina inteira), mas o Router Cache do cliente pode manter
 * uma copia obsoleta ate a proxima navegacao - revalidatePath evita isso.
 */
function revalidateMessageSurfaces(challengeId: string) {
  revalidatePath(editorPath(challengeId));
  revalidatePath(`/admin/desafios/${challengeId}/preview`);
  revalidatePath("/app/dashboard");
  revalidatePath("/app/hoje");
  revalidatePath("/app/jornada");
}

async function findChallengeDay(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  challengeId: string,
  dayNumber: number,
) {
  return supabase
    .from("challenge_days")
    .select("id, message")
    .eq("challenge_id", challengeId)
    .eq("day_number", dayNumber)
    .maybeSingle();
}

/**
 * Salva (ou limpa, quando message vem vazio) a mensagem editorial de UM
 * dia. Sempre permitido mesmo com participantes (editorial, nunca
 * estrutural - ver challenge-editor.core.ts) porque so afeta
 * challenge_days.message, nunca duração/hábitos/regras. Validação real no
 * servidor: challenge_id/day_number precisam corresponder a um
 * challenge_day EXISTENTE deste desafio (nunca cria uma linha nova aqui -
 * generateChallengeDaysAction já é o único jeito de criar dias).
 */
export async function updateChallengeDayMessageAction(formData: FormData) {
  const admin = await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const parsed = challengeDayMessageSchema.safeParse({
    dayNumber: getFormValue(formData, "dayNumber"),
    message: getFormValue(formData, "message"),
  });

  if (!parsed.success) {
    redirectWithFeedback(challengeId, "message-invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingChallenge } = await supabase
    .from("challenges")
    .select("id")
    .eq("id", challengeId)
    .maybeSingle();

  if (!existingChallenge) {
    redirectWithFeedback(challengeId, "error");
  }

  const { data: day } = await findChallengeDay(supabase, challengeId, parsed.data.dayNumber);

  if (!day) {
    redirectWithFeedback(challengeId, "message-day-not-found");
  }

  const sanitized = sanitizeDayMessage(parsed.data.message ?? "");
  const nextMessage = sanitized.length > 0 ? sanitized : null;

  if (nextMessage === day.message) {
    redirectWithFeedback(challengeId, "message-saved");
  }

  const { error } = await supabase
    .from("challenge_days")
    .update({ message: nextMessage })
    .eq("id", day.id);

  if (error) {
    redirectWithFeedback(challengeId, "error");
  }

  // Nunca registra segredos - so o texto editorial em si, que ja e
  // conteúdo público (exibido a qualquer participante do desafio).
  await supabase.from("admin_audit_logs").insert({
    action: "admin_update_challenge_day_message",
    admin_user_id: admin.id,
    after_json: { dayNumber: parsed.data.dayNumber, message: nextMessage },
    before_json: { dayNumber: parsed.data.dayNumber, message: day.message },
    entity_id: day.id,
    entity_type: "challenge_day",
  });

  revalidateMessageSurfaces(challengeId);
  redirectWithFeedback(challengeId, "message-saved");
}

/**
 * "Copiar para outros dias" / "duplicar para intervalo" (Parte D) - uma
 * única ação cobre os dois pedidos do briefing: aplica a mensagem JÁ SALVA
 * do dia de origem a todo dia no intervalo [start, end] deste MESMO
 * desafio. Nunca cria/apaga dias, nunca atravessa desafios. Um lote seguro
 * porque o intervalo é sempre validado contra os dias que realmente
 * existem antes de escrever qualquer linha.
 */
export async function copyChallengeDayMessageToRangeAction(formData: FormData) {
  const admin = await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));
  const parsed = challengeDayMessageRangeSchema.safeParse({
    sourceDayNumber: getFormValue(formData, "sourceDayNumber"),
    targetRangeEnd: getFormValue(formData, "targetRangeEnd"),
    targetRangeStart: getFormValue(formData, "targetRangeStart"),
  });

  if (!parsed.success) {
    redirectWithFeedback(challengeId, "message-invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { data: sourceDay } = await findChallengeDay(supabase, challengeId, parsed.data.sourceDayNumber);

  if (!sourceDay) {
    redirectWithFeedback(challengeId, "message-day-not-found");
  }

  const { data: targetDays } = await supabase
    .from("challenge_days")
    .select("id, day_number, message")
    .eq("challenge_id", challengeId)
    .gte("day_number", parsed.data.targetRangeStart)
    .lte("day_number", parsed.data.targetRangeEnd)
    .neq("id", sourceDay.id);

  if (!targetDays || targetDays.length === 0) {
    redirectWithFeedback(challengeId, "message-day-not-found");
  }

  const { error } = await supabase
    .from("challenge_days")
    .update({ message: sourceDay.message })
    .in(
      "id",
      targetDays.map((day) => day.id),
    );

  if (error) {
    redirectWithFeedback(challengeId, "error");
  }

  await supabase.from("admin_audit_logs").insert(
    targetDays.map((day) => ({
      action: "admin_copy_challenge_day_message",
      admin_user_id: admin.id,
      after_json: { dayNumber: day.day_number, message: sourceDay.message },
      before_json: { dayNumber: day.day_number, message: day.message },
      entity_id: day.id,
      entity_type: "challenge_day",
    })),
  );

  revalidateMessageSurfaces(challengeId);
  redirectWithFeedback(challengeId, "message-copied");
}
