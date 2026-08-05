"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/server/services/admin-session.service";
import {
  adminCreateLibraryContent,
  adminMarkLibraryContentReviewed,
  adminTransitionLibraryContentStatus,
  adminUpdateLibraryContent,
  type AdminLibraryContentInput,
  type LibraryContentStatus,
} from "@/server/services/admin-library.service";
import { isLibraryContentStatus } from "@/features/library/library.core";

export type AdminLibraryActionResult =
  | { fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { contentId?: string; message: string; ok: true };

function getFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getTags(formData: FormData): string[] | undefined {
  const raw = getFormValue(formData, "tags");
  if (!raw) return undefined;
  const tags = raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function revalidateLibraryPaths(id?: string) {
  revalidatePath("/admin/biblioteca");
  revalidatePath("/app/biblioteca");
  revalidatePath("/app/biblioteca/[slug]", "page");
  if (id) {
    revalidatePath(`/admin/biblioteca/${id}/editar`);
    revalidatePath(`/admin/biblioteca/${id}/preview`);
  }
}

function readLibraryFormInput(formData: FormData): Omit<AdminLibraryContentInput, "slug" | "title" | "pillar"> & {
  slug: string;
  title: string;
  pillar: string;
} {
  const readingTimeRaw = getFormValue(formData, "readingTimeMinutes");
  return {
    slug: getFormValue(formData, "slug") ?? "",
    title: getFormValue(formData, "title") ?? "",
    pillar: getFormValue(formData, "pillar") ?? "",
    category: getFormValue(formData, "category"),
    subtitle: getFormValue(formData, "subtitle"),
    summary: getFormValue(formData, "summary"),
    introduction: getFormValue(formData, "introduction"),
    body: getFormValue(formData, "body"),
    practicalApplication: getFormValue(formData, "practicalApplication"),
    reflectionQuestion: getFormValue(formData, "reflectionQuestion"),
    smallAction: getFormValue(formData, "smallAction"),
    finalMessage: getFormValue(formData, "finalMessage"),
    bibleReference: getFormValue(formData, "bibleReference"),
    bibleExcerpt: getFormValue(formData, "bibleExcerpt"),
    tags: getTags(formData),
    readingTimeMinutes: readingTimeRaw ? Number.parseInt(readingTimeRaw, 10) : undefined,
    difficulty: getFormValue(formData, "difficulty"),
    relatedChallengeId: getFormValue(formData, "relatedChallengeId"),
    coverImageUrl: getFormValue(formData, "coverImageUrl"),
    requiresEnhancedReview: formData.get("requiresEnhancedReview") === "on",
  };
}

/**
 * Um conteúdo manual nasce sempre "draft" (Parte 13) - nunca published nem
 * approved diretamente na criação, mesmo que o admin já tenha revisado tudo
 * na cabeça. A transição para os status seguintes é sempre uma ação
 * separada e explícita (ver transitionLibraryContentStatusAction).
 */
export async function createLibraryContentAction(
  _previousState: AdminLibraryActionResult,
  formData: FormData,
): Promise<AdminLibraryActionResult> {
  await requireAdminUser("/admin/biblioteca");

  const input = readLibraryFormInput(formData);
  const fieldErrors: Record<string, string[]> = {};

  if (input.title.length < 3) {
    fieldErrors.title = ["Informe um título com pelo menos 3 caracteres."];
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    fieldErrors.slug = ["Slug inválido - use letras minúsculas, números e hífens."];
  }
  if (!["body", "mind", "character", "spirit"].includes(input.pillar)) {
    fieldErrors.pillar = ["Selecione um pilar."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Revise os campos destacados.", fieldErrors };
  }

  try {
    const id = await adminCreateLibraryContent(input);
    revalidateLibraryPaths(id);
    redirect(`/admin/biblioteca/${id}/editar?feedback=create-success`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return { ok: false, message: "Este slug já está em uso por outro conteúdo." };
    }
    if (error instanceof Error && !error.message.includes("NEXT_REDIRECT")) {
      return { ok: false, message: "Não foi possível salvar agora." };
    }
    throw error;
  }
}

export async function updateLibraryContentAction(
  _previousState: AdminLibraryActionResult,
  formData: FormData,
): Promise<AdminLibraryActionResult> {
  await requireAdminUser("/admin/biblioteca");

  const contentId = getFormValue(formData, "contentId");
  if (!contentId) {
    return { ok: false, message: "Identificador do conteúdo ausente." };
  }

  const input = readLibraryFormInput(formData);
  const fieldErrors: Record<string, string[]> = {};

  if (input.title.length < 3) {
    fieldErrors.title = ["Informe um título com pelo menos 3 caracteres."];
  }
  if (!["body", "mind", "character", "spirit"].includes(input.pillar)) {
    fieldErrors.pillar = ["Selecione um pilar."];
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Revise os campos destacados.", fieldErrors };
  }

  try {
    await adminUpdateLibraryContent(contentId, input);
  } catch {
    return { ok: false, message: "Não foi possível salvar agora." };
  }

  revalidateLibraryPaths(contentId);
  return { ok: true, message: "Conteúdo salvo.", contentId };
}

function resolveRedirectTarget(formData: FormData) {
  const value = formData.get("redirectTo");
  const target = typeof value === "string" && value.startsWith("/admin/") ? value : "/admin/biblioteca";
  const separator = target.includes("?") ? "&" : "?";
  return { separator, target };
}

/**
 * Único ponto de transição de status (Parte 13) - a state machine real
 * mora na RPC `admin_transition_library_content_status`, que já bloqueia
 * qualquer pulo direto para published/scheduled sem passar por approved.
 * Esta action só encaminha a intenção do admin e traduz o resultado.
 */
export async function transitionLibraryContentStatusAction(formData: FormData) {
  await requireAdminUser("/admin/biblioteca");

  const { separator, target } = resolveRedirectTarget(formData);
  const contentId = getFormValue(formData, "contentId");
  const statusRaw = getFormValue(formData, "status");
  const scheduledAt = getFormValue(formData, "scheduledAt");

  if (!contentId || !statusRaw || !isLibraryContentStatus(statusRaw)) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const result = await adminTransitionLibraryContentStatus({
    id: contentId,
    status: statusRaw as LibraryContentStatus,
    scheduledAt,
  });

  revalidateLibraryPaths(contentId);

  if (!result.ok) {
    redirect(`${target}${separator}feedback=transition-error&message=${encodeURIComponent(result.message)}`);
  }

  redirect(`${target}${separator}feedback=transition-success`);
}

export async function markLibraryContentReviewedAction(formData: FormData) {
  const admin = await requireAdminUser("/admin/biblioteca");
  void admin;

  const { separator, target } = resolveRedirectTarget(formData);
  const contentId = getFormValue(formData, "contentId");

  if (!contentId) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  await adminMarkLibraryContentReviewed(contentId);
  revalidateLibraryPaths(contentId);
  redirect(`${target}${separator}feedback=review-success`);
}
