"use server";

import { redirect } from "next/navigation";

import { requireAdminUser } from "@/server/services/admin-session.service";
import { generateLibraryContentDraft } from "@/server/ai/library-content-generation.service";
import { LIBRARY_GENERATION_TONES, type LibraryGenerationTone } from "@/server/ai/library-content-generation.schema";
import { isLibraryPillar } from "@/features/library/library.core";

export type GenerateLibraryContentActionResult =
  | { fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { contentId: string; ok: true };

function getFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isValidTone(value: string | undefined): value is LibraryGenerationTone {
  return Boolean(value) && (LIBRARY_GENERATION_TONES as readonly string[]).includes(value as string);
}

/**
 * A IA nunca cria além de um rascunho draft (Parte 13) - este action só
 * encaminha a intenção e trata os erros; toda a lógica de segurança
 * editorial, allowlist de contexto e validação Zod do output mora em
 * generateLibraryContentDraft, chamado uma única vez aqui.
 */
export async function generateLibraryContentDraftAction(
  _previousState: GenerateLibraryContentActionResult,
  formData: FormData,
): Promise<GenerateLibraryContentActionResult> {
  const admin = await requireAdminUser("/admin/biblioteca");

  const topic = getFormValue(formData, "topic") ?? "";
  const tone = getFormValue(formData, "tone");
  const pillarHint = getFormValue(formData, "pillarHint");
  const category = getFormValue(formData, "category");
  const relatedChallengeId = getFormValue(formData, "relatedChallengeId");
  const targetReadingMinutesRaw = getFormValue(formData, "targetReadingMinutes");

  const fieldErrors: Record<string, string[]> = {};
  if (topic.length < 8) {
    fieldErrors.topic = ["Descreva o tema com pelo menos 8 caracteres."];
  }
  if (!isValidTone(tone)) {
    fieldErrors.tone = ["Selecione um tom válido."];
  }
  if (pillarHint && !isLibraryPillar(pillarHint)) {
    fieldErrors.pillarHint = ["Pilar inválido."];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, message: "Revise os campos destacados.", ok: false };
  }

  const result = await generateLibraryContentDraft({
    actorId: admin.id,
    category,
    pillarHint,
    relatedChallengeId,
    targetReadingMinutes: targetReadingMinutesRaw ? Number.parseInt(targetReadingMinutesRaw, 10) : undefined,
    tone: tone as LibraryGenerationTone,
    topic,
  });

  if (!result.ok) {
    return { message: result.message, ok: false };
  }

  redirect(`/admin/biblioteca/${result.contentId}/editar?feedback=ai-draft-success`);
}
