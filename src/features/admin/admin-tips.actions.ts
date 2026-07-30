"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

import {
  isRecommendedTipImageRatio,
  tipFormSchema,
  tipIdSchema,
  validateTipImageUpload,
} from "./admin-tips.schemas";
import { suggestChallengeSlug } from "./challenge-editor.core";

const TIP_TYPE = "tip";

export type AdminTipActionResult =
  | { fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { message: string; ok: true; ratioWarning?: boolean };

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
  revalidatePath("/app/dicas");
}

/**
 * Minimal draft creation (title + category only) - mirrors
 * createChallengeDraftAction: the full form (slug, image, dates, etc.)
 * happens on the editor page right after, never all at once here.
 */
export async function createTipDraftAction(formData: FormData) {
  await requireAdminUser();

  const title = getFormValue(formData, "title") ?? "";
  const category = getFormValue(formData, "category");

  if (title.trim().length < 3) {
    redirect("/admin/dicas/nova?feedback=invalid");
  }

  const slug = `${suggestChallengeSlug(title)}-${randomUUID().slice(0, 6)}`;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("content_items")
    .insert({
      category: category ?? null,
      slug,
      status: "draft",
      title: title.trim(),
      type: TIP_TYPE,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/admin/dicas/nova?feedback=error");
  }

  redirect(tipEditorPath(data.id));
}

export async function updateTipAction(
  _previousState: AdminTipActionResult,
  formData: FormData,
): Promise<AdminTipActionResult> {
  await requireAdminUser();

  const tipId = tipIdSchema.parse(formData.get("tipId"));

  const parsed = tipFormSchema.safeParse({
    altText: getFormValue(formData, "altText"),
    body: getFormValue(formData, "body"),
    category: getFormValue(formData, "category"),
    challengeId: getFormValue(formData, "challengeId"),
    displayOrder: getFormValue(formData, "displayOrder") ?? "0",
    endsAt: getFormValue(formData, "endsAt"),
    excerpt: getFormValue(formData, "excerpt"),
    slug: getFormValue(formData, "slug") ?? "",
    startsAt: getFormValue(formData, "startsAt"),
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
      body: parsed.data.body ?? null,
      category: parsed.data.category,
      challenge_id: parsed.data.challengeId ?? null,
      display_order: parsed.data.displayOrder,
      ends_at: parsed.data.endsAt ? new Date(parsed.data.endsAt).toISOString() : null,
      excerpt: parsed.data.excerpt ?? null,
      slug: parsed.data.slug,
      starts_at: parsed.data.startsAt ? new Date(parsed.data.startsAt).toISOString() : null,
      title: parsed.data.title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tipId)
    .eq("type", TIP_TYPE);

  if (error) {
    const message =
      error.code === "23505" ? "Este slug já está em uso por outra dica." : "Não foi possível salvar agora.";
    return { ok: false, message };
  }

  revalidateTipPaths(tipId);

  return { ok: true, message: "Dica salva." };
}

/**
 * Uploads always convert to WebP on the server via sharp (already a
 * dependency - Next.js itself uses it for next/image) before storing, so
 * every card in the bucket ends up optimized regardless of what the admin
 * originally exported from their design tool.
 */
export async function uploadTipImageAction(
  _previousState: AdminTipActionResult,
  formData: FormData,
): Promise<AdminTipActionResult> {
  await requireAdminUser();

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

  // Best-effort cleanup of any previous version(s) before uploading the new
  // one - avoids leaving orphaned files behind (same pattern as
  // uploadAvatarAction in profile.actions.ts).
  const { data: existingFiles } = await supabase.storage.from("tip-cards").list(`tips/${tipId}`);
  const staleFiles = (existingFiles ?? []).map((item) => `tips/${tipId}/${item.name}`);

  if (staleFiles.length > 0) {
    await supabase.storage.from("tip-cards").remove(staleFiles);
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  let ratioWarning = false;
  let uploadBuffer: Buffer = originalBuffer;
  let contentType = file.type;
  let extension = validation.extension;

  try {
    const image = sharp(originalBuffer);
    const metadata = await image.metadata();

    if (metadata.width && metadata.height) {
      ratioWarning = !isRecommendedTipImageRatio(metadata.width, metadata.height);
    }

    uploadBuffer = await image.webp({ quality: 85 }).toBuffer();
    contentType = "image/webp";
    extension = "webp";
  } catch {
    // sharp indisponivel ou arquivo que ele nao conseguiu decodificar: mantem
    // o arquivo original (ja validado como jpeg/png/webp) em vez de bloquear
    // o upload por causa de uma otimizacao best-effort.
  }

  const path = `tips/${tipId}/${Date.now()}.${extension}`;
  const uploadBlob = new Blob([new Uint8Array(uploadBuffer)], { type: contentType });

  const { error: uploadError } = await supabase.storage.from("tip-cards").upload(path, uploadBlob, {
    contentType,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false, message: "Não foi possível enviar a imagem agora." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("tip-cards").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("content_items")
    .update({ media_url: `${publicUrl}?v=${Date.now()}`, updated_at: new Date().toISOString() })
    .eq("id", tipId)
    .eq("type", TIP_TYPE);

  if (updateError) {
    return { ok: false, message: "A imagem foi enviada, mas não foi possível salvar." };
  }

  revalidateTipPaths(tipId);

  return {
    ok: true,
    message: ratioWarning
      ? "Imagem enviada. A proporção foge do recomendado (4:5) - revise o preview."
      : "Imagem enviada.",
    ratioWarning,
  };
}

export async function removeTipImageAction(
  _previousState: AdminTipActionResult,
  formData: FormData,
): Promise<AdminTipActionResult> {
  await requireAdminUser();

  const tipId = tipIdSchema.parse(formData.get("tipId"));
  const supabase = await createSupabaseServerClient();

  const { data: existingFiles } = await supabase.storage.from("tip-cards").list(`tips/${tipId}`);
  const paths = (existingFiles ?? []).map((item) => `tips/${tipId}/${item.name}`);

  if (paths.length > 0) {
    await supabase.storage.from("tip-cards").remove(paths);
  }

  const { error } = await supabase
    .from("content_items")
    .update({ media_url: null, updated_at: new Date().toISOString() })
    .eq("id", tipId)
    .eq("type", TIP_TYPE);

  if (error) {
    return { ok: false, message: "Não foi possível remover a imagem agora." };
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
 * Publishing is blocked without an image - a "Dica" in this product is a
 * visual card by definition (see admin-tips.schemas.ts / round scope: image
 * upload is mandatory before a card can go live).
 */
export async function publishTipAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const tipId = tipIdSchema.safeParse(formData.get("tipId"));

  if (!tipId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: tip } = await supabase
    .from("content_items")
    .select("media_url, published_at")
    .eq("id", tipId.data)
    .eq("type", TIP_TYPE)
    .maybeSingle();

  if (!tip) {
    redirect(`${target}${separator}feedback=error`);
  }

  if (!tip.media_url) {
    redirect(`${target}${separator}feedback=publish-needs-image`);
  }

  const { error } = await supabase
    .from("content_items")
    .update({
      published_at: tip.published_at ?? new Date().toISOString(),
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", tipId.data)
    .eq("type", TIP_TYPE);

  if (error) {
    redirect(`${target}${separator}feedback=error`);
  }

  revalidateTipPaths(tipId.data);
  redirect(`${target}${separator}feedback=publish-success`);
}

async function transitionTipStatus(
  formData: FormData,
  status: "archived" | "draft",
  successFeedback: string,
) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const tipId = tipIdSchema.safeParse(formData.get("tipId"));

  if (!tipId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", tipId.data)
    .eq("type", TIP_TYPE);

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
  await requireAdminUser();

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
    .eq("type", TIP_TYPE)
    .maybeSingle();

  if (!original) {
    redirect(`${target}${separator}feedback=error`);
  }

  const newSlug = `${original.slug}-copia-${randomUUID().slice(0, 8)}`;

  const { error } = await supabase.from("content_items").insert({
    alt_text: original.alt_text,
    body: original.body,
    category: original.category,
    challenge_id: original.challenge_id,
    display_order: original.display_order,
    excerpt: original.excerpt,
    // Duplicar nunca copia a janela de exibicao nem a imagem automaticamente
    // como "ja publicavel" - a copia sempre nasce rascunho, sem media_url,
    // exigindo que o admin faça upload de novo antes de publicar.
    slug: newSlug,
    status: "draft",
    title: `${original.title} (cópia)`,
    type: TIP_TYPE,
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
    .eq("type", TIP_TYPE);

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
