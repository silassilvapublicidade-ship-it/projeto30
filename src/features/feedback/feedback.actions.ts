"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import sharp from "sharp";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDeployInfo } from "@/config/system-version";
import { recordSystemError } from "@/server/services/system-observability.service";
import { createFeedback, withdrawFeedback } from "@/server/services/feedback.service";
import { requireAuthUser } from "@/server/services/auth-session.service";

import { categoriesForType, isFeedbackType } from "./feedback.core";
import { feedbackFormSchema, validateFeedbackAttachmentUpload } from "./feedback.schemas";

export type SubmitFeedbackActionResult =
  | { ok: true; protocolCode: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

async function optimizeFeedbackAttachment(originalBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const buffer = await sharp(originalBuffer).rotate().webp({ quality: 82 }).toBuffer();
    return { buffer, contentType: "image/webp" };
  } catch {
    return { buffer: originalBuffer, contentType: "application/octet-stream" };
  }
}

export async function submitFeedbackAction(formData: FormData): Promise<SubmitFeedbackActionResult> {
  const user = await requireAuthUser("/app/feedback");

  const feedbackTypeRaw = String(formData.get("feedbackType") ?? "");
  if (!isFeedbackType(feedbackTypeRaw)) {
    return { ok: false, message: "Tipo de feedback inválido." };
  }

  const categoryRaw = String(formData.get("category") ?? "").trim();
  const allowedCategories = categoriesForType(feedbackTypeRaw) as readonly string[];
  const category = allowedCategories.includes(categoryRaw) ? categoryRaw : undefined;

  const parsed = feedbackFormSchema.safeParse({
    feedbackType: feedbackTypeRaw,
    category,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    sentiment: String(formData.get("sentiment") ?? "") || undefined,
    allowContact: formData.get("allowContact") === "on",
    includeTechnical: formData.get("includeTechnical") === "on",
    route: String(formData.get("route") ?? "") || undefined,
    diagnosticCode: String(formData.get("diagnosticCode") ?? "") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: "Revise os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const feedbackId = randomUUID();
  let attachmentStoragePath: string | null = null;

  const attachment = formData.get("attachment");
  if (attachment instanceof File && attachment.size > 0) {
    const validation = validateFeedbackAttachmentUpload({ size: attachment.size, type: attachment.type });
    if (!validation.ok) {
      return { ok: false, message: validation.message };
    }

    const originalBuffer = Buffer.from(await attachment.arrayBuffer());
    const optimized = await optimizeFeedbackAttachment(originalBuffer);
    const path = `feedback/${user.id}/${feedbackId}.webp`;
    const supabase = await createSupabaseServerClient();

    const { error: uploadError } = await supabase.storage
      .from("user-feedback-attachments")
      .upload(path, new Blob([new Uint8Array(optimized.buffer)], { type: optimized.contentType }), {
        contentType: optimized.contentType,
        upsert: false,
      });

    if (uploadError) {
      await recordSystemError({
        area: "feedback",
        operation: "feedback_attachment_upload",
        severity: "warning",
        message: "Falha ao enviar o anexo do feedback.",
        route: "/app/feedback",
        userId: user.id,
      });
      return { ok: false, message: "Não foi possível enviar a imagem agora. Tente enviar o feedback sem anexo." };
    }

    attachmentStoragePath = path;
  }

  const deployInfo = getDeployInfo();

  try {
    const created = await createFeedback({
      id: feedbackId,
      feedbackType: parsed.data.feedbackType,
      category: parsed.data.category ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      sentiment: parsed.data.sentiment ?? null,
      allowContact: parsed.data.allowContact,
      includeTechnical: parsed.data.includeTechnical,
      route: parsed.data.route ?? null,
      diagnosticCode: parsed.data.diagnosticCode ?? null,
      appVersion: deployInfo.commitShaShort ?? null,
      browser: String(formData.get("browser") ?? "") || null,
      operatingSystem: String(formData.get("operatingSystem") ?? "") || null,
      isPwa: formData.get("isPwa") === "true",
      viewport: String(formData.get("viewport") ?? "") || null,
      attachmentStoragePath,
    });

    const supabase = await createSupabaseServerClient();
    await supabase.rpc("record_analytics_event", {
      p_event_name: "feedback_submitted",
      p_metadata: { feedbackType: parsed.data.feedbackType, hasAttachment: Boolean(attachmentStoragePath) },
      p_source: "server",
    });
    if (attachmentStoragePath) {
      await supabase.rpc("record_analytics_event", { p_event_name: "feedback_attachment_added", p_source: "server" });
    }

    return { ok: true, protocolCode: created.protocolCode };
  } catch (error) {
    await recordSystemError({
      area: "feedback",
      operation: "feedback_submit",
      severity: "warning",
      message: error instanceof Error ? error.message : "Falha ao registrar feedback.",
      route: "/app/feedback",
      userId: user.id,
    });
    return { ok: false, message: "Não foi possível enviar seu feedback agora. Tente novamente em instantes." };
  }
}

export async function withdrawFeedbackAction(formData: FormData) {
  await requireAuthUser("/app/feedback/meus");
  const id = String(formData.get("id") ?? "");
  if (id) {
    await withdrawFeedback(id);
  }
  redirect("/app/feedback/meus");
}
