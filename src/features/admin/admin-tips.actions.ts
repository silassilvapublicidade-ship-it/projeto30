"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { runNewTipPublishedAutomation } from "@/server/services/notification-automations.service";

import {
  isRecommendedTipImageRatio,
  TIP_CATEGORIES,
  tipFormSchema,
  tipIdSchema,
  validateTipImageUpload,
} from "./admin-tips.schemas";
import { suggestChallengeSlug } from "./challenge-editor.core";

const TIP_CONTENT_TYPE = "tip_card";

export type AdminTipActionResult =
  | { fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { message: string; ok: true; ratioWarning?: boolean; tipId?: string };

function tipEditorPath(id: string) {
  return `/admin/dicas/${id}/editar`;
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function revalidateTipPaths(tipId: string) {
  revalidatePath("/admin/dicas");
  revalidatePath(tipEditorPath(tipId));
  revalidatePath(`/admin/dicas/${tipId}/preview`);
  revalidatePath("/app/dicas");
  revalidatePath("/app/dicas/[slug]", "page");
}

/**
 * Converts to WebP via sharp (already a dependency - Next.js itself uses it
 * for next/image) and reports whether the source image strays from the
 * recommended 4:5 ratio. Falls back to the original validated bytes if
 * sharp can't decode the file, rather than blocking the upload over a
 * best-effort optimization.
 */
async function optimizeTipImage(
  originalBuffer: Buffer,
  fallbackExtension: string,
  fallbackContentType: string,
): Promise<{ buffer: Buffer; contentType: string; extension: string; ratioWarning: boolean }> {
  try {
    const image = sharp(originalBuffer);
    const metadata = await image.metadata();
    const ratioWarning =
      metadata.width && metadata.height
        ? !isRecommendedTipImageRatio(metadata.width, metadata.height)
        : false;
    const buffer = await image.webp({ quality: 85 }).toBuffer();

    return { buffer, contentType: "image/webp", extension: "webp", ratioWarning };
  } catch {
    return {
      buffer: originalBuffer,
      contentType: fallbackContentType,
      extension: fallbackExtension,
      ratioWarning: false,
    };
  }
}

/**
 * Single-screen creation: image + title + category + display order (all
 * required) plus the optional fields, submitted together with either the
 * "Salvar como rascunho" or "Publicar agora" button (both post here, the
 * clicked button's value tells this action which one). The id is generated
 * upfront so the image can be uploaded to its final tips/{id}/ path and the
 * row inserted already complete in one call, instead of the old two-step
 * "create empty shell, then edit" flow.
 */
export async function createTipCardAction(
  _previousState: AdminTipActionResult,
  formData: FormData,
): Promise<AdminTipActionResult> {
  const admin = await requireAdminUser();

  const title = getFormValue(formData, "title") ?? "";
  const category = getFormValue(formData, "category");
  const intent = formData.get("intent") === "publish" ? "publish" : "draft";
  const file = formData.get("image");
  const fieldErrors: Record<string, string[]> = {};

  if (title.trim().length < 3) {
    fieldErrors.title = ["Informe um título com pelo menos 3 caracteres."];
  }

  if (!category || !TIP_CATEGORIES.includes(category as (typeof TIP_CATEGORIES)[number])) {
    fieldErrors.category = ["Selecione uma categoria."];
  }

  const hasFile = file instanceof File && file.size > 0;

  if (!hasFile) {
    fieldErrors.image = ["Envie uma imagem para o card."];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Revise os campos destacados.", fieldErrors };
  }

  const parsed = tipFormSchema.safeParse({
    altText: getFormValue(formData, "altText"),
    category,
    challengeId: getFormValue(formData, "challengeId"),
    content: getFormValue(formData, "content"),
    displayOrder: getFormValue(formData, "displayOrder") ?? "0",
    endsAt: getFormValue(formData, "endsAt"),
    slug: getFormValue(formData, "slug") ?? `${suggestChallengeSlug(title)}-${randomUUID().slice(0, 6)}`,
    startsAt: getFormValue(formData, "startsAt"),
    summary: getFormValue(formData, "summary"),
    title,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const validation = validateTipImageUpload({
    size: (file as File).size,
    type: (file as File).type,
  });

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const newId = randomUUID();
  const originalBuffer = Buffer.from(await (file as File).arrayBuffer());
  const optimized = await optimizeTipImage(originalBuffer, validation.extension, (file as File).type);
  const storagePath = `tips/${newId}/${Date.now()}.${optimized.extension}`;
  const supabase = await createSupabaseServerClient();

  const { error: uploadError } = await supabase.storage
    .from("tip-cards")
    .upload(storagePath, new Blob([new Uint8Array(optimized.buffer)], { type: optimized.contentType }), {
      contentType: optimized.contentType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, message: "Não foi possível enviar a imagem agora." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("tip-cards").getPublicUrl(storagePath);

  const { error: insertError } = await supabase.from("content_items").insert({
    alt_text: parsed.data.altText ?? null,
    category: parsed.data.category,
    challenge_id: parsed.data.challengeId ?? null,
    content: parsed.data.content ?? null,
    content_type: TIP_CONTENT_TYPE,
    created_by: admin.id,
    display_order: parsed.data.displayOrder,
    ends_at: parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null,
    id: newId,
    image_storage_path: storagePath,
    image_url: `${publicUrl}?v=${Date.now()}`,
    published_at: intent === "publish" ? new Date().toISOString() : null,
    slug: parsed.data.slug,
    starts_at: parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null,
    status: intent === "publish" ? "published" : "draft",
    summary: parsed.data.summary ?? null,
    title: parsed.data.title,
  });

  if (insertError) {
    // Best-effort cleanup so a failed insert doesn't orphan the file we just
    // uploaded under an id nothing will ever reference.
    await supabase.storage.from("tip-cards").remove([storagePath]);

    const message =
      insertError.code === "23505" ? "Este slug já está em uso por outra dica." : "Não foi possível salvar agora.";
    return { ok: false, message };
  }

  revalidateTipPaths(newId);
  redirect(`${tipEditorPath(newId)}?feedback=create-success`);
}

export async function updateTipAction(
  _previousState: AdminTipActionResult,
  formData: FormData,
): Promise<AdminTipActionResult> {
  const admin = await requireAdminUser();

  const tipId = tipIdSchema.parse(formData.get("tipId"));

  const parsed = tipFormSchema.safeParse({
    altText: getFormValue(formData, "altText"),
    category: getFormValue(formData, "category"),
    challengeId: getFormValue(formData, "challengeId"),
    content: getFormValue(formData, "content"),
    displayOrder: getFormValue(formData, "displayOrder") ?? "0",
    endsAt: getFormValue(formData, "endsAt"),
    slug: getFormValue(formData, "slug") ?? "",
    startsAt: getFormValue(formData, "startsAt"),
    summary: getFormValue(formData, "summary"),
    title: getFormValue(formData, "title") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_items")
    .update({
      alt_text: parsed.data.altText ?? null,
      category: parsed.data.category,
      challenge_id: parsed.data.challengeId ?? null,
      content: parsed.data.content ?? null,
      display_order: parsed.data.displayOrder,
      ends_at: parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null,
      slug: parsed.data.slug,
      starts_at: parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null,
      summary: parsed.data.summary ?? null,
      title: parsed.data.title,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("id", tipId)
    .eq("content_type", TIP_CONTENT_TYPE);

  if (error) {
    const message =
      error.code === "23505" ? "Este slug já está em uso por outra dica." : "Não foi possível salvar agora.";
    return { ok: false, message };
  }

  revalidateTipPaths(tipId);

  return { ok: true, message: "Dica salva." };
}

/**
 * Uploads always convert to WebP on the server via sharp before storing, so
 * every card in the bucket ends up optimized regardless of what the admin
 * originally exported from their design tool. Replacing an existing image:
 * the new file is uploaded and the row is updated to point at it FIRST, and
 * only then is the previous file removed - so a failed upload never leaves
 * the card pointing at nothing, and a failed removal (rare) only leaves a
 * harmless extra file rather than a broken card.
 */
export async function uploadTipImageAction(
  _previousState: AdminTipActionResult,
  formData: FormData,
): Promise<AdminTipActionResult> {
  const admin = await requireAdminUser();

  const tipId = tipIdSchema.parse(formData.get("tipId"));
  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecione uma imagem para enviar." };
  }

  const validation = validateTipImageUpload({ size: file.size, type: file.type });

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("content_items")
    .select("image_storage_path")
    .eq("id", tipId)
    .eq("content_type", TIP_CONTENT_TYPE)
    .maybeSingle();

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const optimized = await optimizeTipImage(originalBuffer, validation.extension, file.type);
  const storagePath = `tips/${tipId}/${Date.now()}.${optimized.extension}`;

  const { error: uploadError } = await supabase.storage
    .from("tip-cards")
    .upload(storagePath, new Blob([new Uint8Array(optimized.buffer)], { type: optimized.contentType }), {
      contentType: optimized.contentType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, message: "Não foi possível enviar a imagem agora." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("tip-cards").getPublicUrl(storagePath);

  const { error: updateError } = await supabase
    .from("content_items")
    .update({
      image_storage_path: storagePath,
      image_url: `${publicUrl}?v=${Date.now()}`,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("id", tipId)
    .eq("content_type", TIP_CONTENT_TYPE);

  if (updateError) {
    await supabase.storage.from("tip-cards").remove([storagePath]);
    return { ok: false, message: "A imagem foi enviada, mas não foi possível salvar." };
  }

  // Only remove the previous file once the new one is confirmed live on the
  // row - never delete-then-upload, which would risk leaving the card
  // pointing at nothing if the upload step failed.
  if (existing?.image_storage_path && existing.image_storage_path !== storagePath) {
    await supabase.storage.from("tip-cards").remove([existing.image_storage_path]);
  }

  revalidateTipPaths(tipId);

  return {
    ok: true,
    message: optimized.ratioWarning
      ? "Imagem enviada. A proporção foge do recomendado (4:5) - revise o preview."
      : "Imagem enviada.",
    ratioWarning: optimized.ratioWarning,
  };
}

export async function removeTipImageAction(
  _previousState: AdminTipActionResult,
  formData: FormData,
): Promise<AdminTipActionResult> {
  const admin = await requireAdminUser();

  const tipId = tipIdSchema.parse(formData.get("tipId"));
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("content_items")
    .select("image_storage_path")
    .eq("id", tipId)
    .eq("content_type", TIP_CONTENT_TYPE)
    .maybeSingle();

  const { error } = await supabase
    .from("content_items")
    .update({
      image_storage_path: null,
      image_url: null,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("id", tipId)
    .eq("content_type", TIP_CONTENT_TYPE);

  if (error) {
    return { ok: false, message: "Não foi possível remover a imagem agora." };
  }

  if (existing?.image_storage_path) {
    await supabase.storage.from("tip-cards").remove([existing.image_storage_path]);
  }

  revalidateTipPaths(tipId);

  return { ok: true, message: "Imagem removida." };
}

function resolveRedirectTarget(formData: FormData) {
  const value = formData.get("redirectTo");
  const target = typeof value === "string" && value.startsWith("/admin/") ? value : "/admin/dicas";
  const separator = target.includes("?") ? "&" : "?";
  return { separator, target };
}

/**
 * Publishing is blocked without an image, a title and a category - a "Dica"
 * in this product is a visual card by definition. Works from both draft and
 * archived (no status precondition beyond "has an image") - "Publicar" and
 * "Publicar novamente" in the menu are the same action under two labels.
 *
 * The optional "avisar usuários" checkbox (name="notifyUsers") only ever
 * fires the new-tip-published automation from THIS explicit submission - it
 * is never inferred, never carried over, and never fires for
 * unpublish/archive. Re-publishing the same tip with the box checked again
 * notifies again on purpose (a fresh confirmation each time), which is why
 * the automation's idempotency key is based on this call's own timestamp
 * rather than content_items.published_at (which re-publish deliberately
 * leaves untouched below).
 */
export async function publishTipAction(formData: FormData) {
  const admin = await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const tipId = tipIdSchema.safeParse(formData.get("tipId"));
  const notifyUsers = formData.get("notifyUsers") === "on";

  if (!tipId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: tip } = await supabase
    .from("content_items")
    .select("category, image_url, published_at, slug, title")
    .eq("id", tipId.data)
    .eq("content_type", TIP_CONTENT_TYPE)
    .maybeSingle();

  if (!tip) {
    redirect(`${target}${separator}feedback=error`);
  }

  if (!tip.image_url || !tip.title || !tip.category) {
    redirect(`${target}${separator}feedback=publish-needs-image`);
  }

  const { error } = await supabase
    .from("content_items")
    .update({
      published_at: tip.published_at ?? new Date().toISOString(),
      status: "published",
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("id", tipId.data)
    .eq("content_type", TIP_CONTENT_TYPE);

  if (error) {
    redirect(`${target}${separator}feedback=error`);
  }

  if (notifyUsers) {
    await runNewTipPublishedAutomation({
      publishedAt: new Date().toISOString(),
      tipId: tipId.data,
      tipSlug: tip.slug,
      tipTitle: tip.title,
    });
  }

  revalidateTipPaths(tipId.data);
  redirect(`${target}${separator}feedback=publish-success`);
}

async function transitionTipStatus(
  formData: FormData,
  status: "archived" | "draft",
  successFeedback: string,
) {
  const admin = await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const tipId = tipIdSchema.safeParse(formData.get("tipId"));

  if (!tipId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_items")
    .update({ status, updated_at: new Date().toISOString(), updated_by: admin.id })
    .eq("id", tipId.data)
    .eq("content_type", TIP_CONTENT_TYPE);

  if (error) {
    redirect(`${target}${separator}feedback=error`);
  }

  revalidateTipPaths(tipId.data);
  redirect(`${target}${separator}feedback=${successFeedback}`);
}

export async function unpublishTipAction(formData: FormData) {
  // Volta para draft (mesmo padrao de unpublishChallengeAction): remove
  // imediatamente de /app/dicas (RLS/queries so leem status = published),
  // mas preserva o registro e a imagem no bucket.
  await transitionTipStatus(formData, "draft", "unpublish-success");
}

export async function archiveTipAction(formData: FormData) {
  await transitionTipStatus(formData, "archived", "archive-success");
}

export async function duplicateTipAsDraftAction(formData: FormData) {
  const admin = await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const tipId = tipIdSchema.safeParse(formData.get("tipId"));

  if (!tipId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: original } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", tipId.data)
    .eq("content_type", TIP_CONTENT_TYPE)
    .maybeSingle();

  if (!original) {
    redirect(`${target}${separator}feedback=error`);
  }

  const newSlug = `${original.slug}-copia-${randomUUID().slice(0, 8)}`;

  const { error } = await supabase.from("content_items").insert({
    alt_text: original.alt_text,
    category: original.category,
    challenge_id: original.challenge_id,
    content: original.content,
    content_type: TIP_CONTENT_TYPE,
    created_by: admin.id,
    display_order: original.display_order,
    // Duplicar nunca copia a janela de exibicao, imagem ou published_at como
    // "ja publicavel" - a copia sempre nasce rascunho, sem imagem propria,
    // exigindo que o admin faca upload de novo antes de publicar.
    slug: newSlug,
    status: "draft",
    summary: original.summary,
    title: `${original.title} (cópia)`,
  });

  if (error) {
    redirect(`${target}${separator}feedback=error`);
  }

  redirect(`${target}${separator}feedback=duplicate-success`);
}

/**
 * Deletes the row and removes every file under its own storage prefix
 * (tips/{id}/) - each tip owns an exclusive path, so this can never remove
 * an image another content item references.
 */
export async function deleteTipAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const tipId = tipIdSchema.safeParse(formData.get("tipId"));

  if (!tipId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("content_items")
    .delete()
    .eq("id", tipId.data)
    .eq("content_type", TIP_CONTENT_TYPE);

  if (error) {
    redirect(`${target}${separator}feedback=error`);
  }

  const { data: files } = await supabase.storage.from("tip-cards").list(`tips/${tipId.data}`);
  const paths = (files ?? []).map((item) => `tips/${tipId.data}/${item.name}`);

  if (paths.length > 0) {
    await supabase.storage.from("tip-cards").remove(paths);
  }

  revalidateTipPaths(tipId.data);
  redirect(`${target}${separator}feedback=delete-success`);
}
