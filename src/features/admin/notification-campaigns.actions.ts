"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { logRpcFailure } from "@/server/services/rpc-logging.service";
import { processNotificationCampaign } from "@/server/services/notification-dispatch.service";
import {
  searchUsersForNotificationPicker,
  type UserOption,
} from "@/server/services/admin-notification-campaigns.service";

import {
  campaignFormSchema,
  campaignIdSchema,
  MAX_NOTIFICATION_IMAGE_SIZE_BYTES,
  REQUIRED_SEND_CONFIRMATION_PHRASE,
  validateNotificationImageUpload,
} from "./notification-campaigns.schemas";

export type AdminCampaignActionResult =
  | { campaignId?: string; fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { campaignId?: string; message: string; ok: true };

function campaignDetailPath(id: string) {
  return `/admin/notificacoes/${id}`;
}

function revalidateCampaignPaths(campaignId?: string) {
  revalidatePath("/admin/notificacoes");
  if (campaignId) {
    revalidatePath(campaignDetailPath(campaignId));
    revalidatePath(`${campaignDetailPath(campaignId)}/editar`);
  }
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseCampaignForm(formData: FormData) {
  return campaignFormSchema.safeParse({
    actionLabel: getFormValue(formData, "actionLabel"),
    audienceType: getFormValue(formData, "audienceType"),
    channelInternal: formData.get("channelInternal") === "on",
    channelPush: formData.get("channelPush") === "on",
    challengeId: getFormValue(formData, "challengeId"),
    destinationReferenceId: getFormValue(formData, "destinationReferenceId"),
    destinationType: getFormValue(formData, "destinationType"),
    imageUrl: getFormValue(formData, "imageUrl"),
    message: getFormValue(formData, "message") ?? "",
    specificUserId: getFormValue(formData, "specificUserId"),
    title: getFormValue(formData, "title") ?? "",
  });
}

export async function createNotificationCampaignAction(
  _previousState: AdminCampaignActionResult,
  formData: FormData,
): Promise<AdminCampaignActionResult> {
  await requireAdminUser();

  const parsed = parseCampaignForm(formData);

  if (!parsed.success) {
    return { ok: false, message: "Revise os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_create_notification_campaign", {
    p_action_label: parsed.data.actionLabel,
    p_audience_type: parsed.data.audienceType,
    p_challenge_id: parsed.data.challengeId,
    p_channel_internal: parsed.data.channelInternal,
    p_channel_push: parsed.data.channelPush,
    p_destination_reference_id: parsed.data.destinationReferenceId,
    p_destination_type: parsed.data.destinationType,
    p_image_url: parsed.data.imageUrl,
    p_message: parsed.data.message,
    p_specific_user_id: parsed.data.specificUserId,
    p_title: parsed.data.title,
  });

  if (error) {
    logRpcFailure("admin_create_notification_campaign", error);
    return { ok: false, message: "Não foi possível criar a campanha agora." };
  }

  revalidateCampaignPaths(data);
  redirect(`${campaignDetailPath(data)}?feedback=create-success`);
}

export async function updateNotificationCampaignAction(
  _previousState: AdminCampaignActionResult,
  formData: FormData,
): Promise<AdminCampaignActionResult> {
  await requireAdminUser();

  const campaignId = campaignIdSchema.parse(formData.get("campaignId"));
  const parsed = parseCampaignForm(formData);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      campaignId,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_notification_campaign", {
    p_action_label: parsed.data.actionLabel,
    p_audience_type: parsed.data.audienceType,
    p_campaign_id: campaignId,
    p_challenge_id: parsed.data.challengeId,
    p_channel_internal: parsed.data.channelInternal,
    p_channel_push: parsed.data.channelPush,
    p_destination_reference_id: parsed.data.destinationReferenceId,
    p_destination_type: parsed.data.destinationType,
    p_image_url: parsed.data.imageUrl,
    p_message: parsed.data.message,
    p_specific_user_id: parsed.data.specificUserId,
    p_title: parsed.data.title,
  });

  if (error) {
    logRpcFailure("admin_update_notification_campaign", error);
    return {
      ok: false,
      message: error.code === "22023" ? error.message : "Não foi possível salvar agora.",
      campaignId,
    };
  }

  revalidateCampaignPaths(campaignId);
  return { ok: true, message: "Campanha salva.", campaignId };
}

function resolveRedirectTarget(formData: FormData) {
  const value = formData.get("redirectTo");
  const target = typeof value === "string" && value.startsWith("/admin/") ? value : "/admin/notificacoes";
  const separator = target.includes("?") ? "&" : "?";
  return { separator, target };
}

export async function scheduleNotificationCampaignAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const campaignId = campaignIdSchema.safeParse(formData.get("campaignId"));
  const scheduledForRaw = formData.get("scheduledFor");

  if (!campaignId.success || typeof scheduledForRaw !== "string" || !scheduledForRaw) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const scheduledFor = new Date(scheduledForRaw);

  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
    redirect(`${target}${separator}feedback=schedule-blocked`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_schedule_notification_campaign", {
    p_campaign_id: campaignId.data,
    p_scheduled_for: scheduledFor.toISOString(),
  });

  if (error) {
    logRpcFailure("admin_schedule_notification_campaign", error);
    redirect(`${target}${separator}feedback=schedule-blocked`);
  }

  revalidateCampaignPaths(campaignId.data);
  redirect(`${target}${separator}feedback=schedule-success`);
}

/**
 * The only action gated behind the typed "ENVIAR NOTIFICAÇÃO" confirmation
 * (enforced again here server-side, never trusting the client-disabled
 * button alone). Flips the campaign to 'processing' via the RPC, then runs
 * the real batch dispatch synchronously before redirecting - see
 * notification-dispatch.service.ts, the same engine the cron route calls
 * for scheduled campaigns and automations.
 */
export async function startNotificationCampaignNowAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const campaignId = campaignIdSchema.safeParse(formData.get("campaignId"));
  const confirmationPhrase = formData.get("confirmationPhrase");

  if (!campaignId.success || confirmationPhrase !== REQUIRED_SEND_CONFIRMATION_PHRASE) {
    redirect(`${target}${separator}feedback=send-blocked`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_start_notification_campaign_now", {
    p_campaign_id: campaignId.data,
  });

  if (error) {
    logRpcFailure("admin_start_notification_campaign_now", error);
    redirect(`${target}${separator}feedback=send-blocked`);
  }

  await processNotificationCampaign(campaignId.data);

  revalidateCampaignPaths(campaignId.data);
  redirect(`${campaignDetailPath(campaignId.data)}?feedback=send-success`);
}

export async function cancelNotificationCampaignAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const campaignId = campaignIdSchema.safeParse(formData.get("campaignId"));

  if (!campaignId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_cancel_notification_campaign", {
    p_campaign_id: campaignId.data,
  });

  if (error) {
    logRpcFailure("admin_cancel_notification_campaign", error);
    redirect(`${target}${separator}feedback=cancel-blocked`);
  }

  revalidateCampaignPaths(campaignId.data);
  redirect(`${target}${separator}feedback=cancel-success`);
}

export async function deleteNotificationCampaignDraftAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const campaignId = campaignIdSchema.safeParse(formData.get("campaignId"));

  if (!campaignId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_delete_notification_campaign_draft", {
    p_campaign_id: campaignId.data,
  });

  if (error) {
    logRpcFailure("admin_delete_notification_campaign_draft", error);
    redirect(`${target}${separator}feedback=delete-blocked`);
  }

  revalidateCampaignPaths();
  redirect(`${target}${separator}feedback=delete-success`);
}

export async function duplicateNotificationCampaignAction(formData: FormData) {
  const admin = await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const campaignId = campaignIdSchema.safeParse(formData.get("campaignId"));

  if (!campaignId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_duplicate_notification_campaign", {
    p_campaign_id: campaignId.data,
  });

  if (error) {
    logRpcFailure("admin_duplicate_notification_campaign", error);
    redirect(`${target}${separator}feedback=error`);
  }

  await supabase.from("admin_audit_logs").insert({
    action: "admin_duplicate_notification_campaign",
    admin_user_id: admin.id,
    entity_id: data,
    entity_type: "notification_campaign",
  });

  revalidateCampaignPaths();
  redirect(`${campaignDetailPath(data)}?feedback=duplicate-success`);
}

export type AudienceEstimateResult = { count: number; ok: true } | { ok: false };

/**
 * Called directly from the compositor's client component (not a <form>
 * submit) to keep the audience estimate live as the admin changes filters -
 * always re-runs the same resolve_notification_audience the real send uses,
 * so the number shown can never diverge from what will actually be sent.
 */
export async function estimateNotificationAudienceAction(input: {
  audienceType: string;
  challengeId?: string | null;
  specificUserId?: string | null;
}): Promise<AudienceEstimateResult> {
  await requireAdminUser();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_estimate_notification_audience", {
    p_audience_type: input.audienceType,
    p_challenge_id: input.challengeId ?? undefined,
    p_specific_user_id: input.specificUserId ?? undefined,
  });

  if (error || typeof data !== "number") {
    logRpcFailure("admin_estimate_notification_audience", error ?? { message: "unexpected null" });
    return { ok: false };
  }

  return { ok: true, count: data };
}

export async function searchNotificationUsersAction(search: string): Promise<UserOption[]> {
  await requireAdminUser();
  return searchUsersForNotificationPicker(search);
}

async function optimizeNotificationImage(
  originalBuffer: Buffer,
  fallbackExtension: string,
  fallbackContentType: string,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  try {
    const buffer = await sharp(originalBuffer).webp({ quality: 85 }).toBuffer();
    return { buffer, contentType: "image/webp", extension: "webp" };
  } catch {
    return { buffer: originalBuffer, contentType: fallbackContentType, extension: fallbackExtension };
  }
}

export type UploadNotificationImageResult =
  | { imageUrl: string; ok: true }
  | { message: string; ok: false };

/**
 * Uploads independently of any campaign row (the compositor can upload an
 * image before the campaign is even created) - returns a public URL the
 * form then carries as a hidden field into create/update. Storage path is
 * random per upload, never reused, so an abandoned draft never overwrites
 * another campaign's image.
 */
export async function uploadNotificationImageAction(
  _previousState: UploadNotificationImageResult,
  formData: FormData,
): Promise<UploadNotificationImageResult> {
  await requireAdminUser();

  const file = formData.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecione uma imagem para enviar." };
  }

  const validation = validateNotificationImageUpload({ size: file.size, type: file.type });

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  if (file.size > MAX_NOTIFICATION_IMAGE_SIZE_BYTES) {
    return { ok: false, message: "A imagem precisa ter até 10 MB." };
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const optimized = await optimizeNotificationImage(originalBuffer, validation.extension, file.type);
  const storagePath = `campaigns/${randomUUID()}/${Date.now()}.${optimized.extension}`;

  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from("notification-images")
    .upload(storagePath, new Blob([new Uint8Array(optimized.buffer)], { type: optimized.contentType }), {
      contentType: optimized.contentType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, message: "Não foi possível enviar a imagem agora." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("notification-images").getPublicUrl(storagePath);

  return { ok: true, imageUrl: `${publicUrl}?v=${Date.now()}` };
}
