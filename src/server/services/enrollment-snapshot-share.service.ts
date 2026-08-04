import "server-only";

import type { ShareCardFormat } from "@/features/achievements/achievement-art.schemas";
import {
  buildProgressCardContent,
  buildProgressShareCardStoragePath,
  computeProgressSharePayloadHash,
} from "@/features/achievements/progress-card.core";
import { getDateOnlyInTimeZone, getPreviousDateOnly } from "@/features/challenges/date.core";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderProgressShareCardImage } from "@/server/rendering/achievement-share-card.render";

import { requireAuthUser } from "./auth-session.service";
import { getProfileOverview } from "./profile-dashboard.service";
import { recordSystemError } from "./system-observability.service";

const SHARE_CARD_BUCKET = "achievement-share-cards";
const TEMPLATE_VERSION = 1;

/** Os 5 tipos que fotografam o ESTADO da inscricao - nunca um dia isolado (ver ENROLLMENT_SNAPSHOT_PROGRESS_CARD_KINDS). */
export type SnapshotProgressCardKind =
  | "challenge_completed"
  | "challenge_progress"
  | "halfway"
  | "last_7_days"
  | "weekly_summary";

const TEMPLATE_SLUGS: Record<SnapshotProgressCardKind, Record<ShareCardFormat, string>> = {
  challenge_completed: { feed: "challenge_completed_feed", story: "challenge_completed_story" },
  challenge_progress: { feed: "challenge_progress_feed", story: "challenge_progress_story" },
  halfway: { feed: "halfway_feed", story: "halfway_story" },
  last_7_days: { feed: "last_7_days_feed", story: "last_7_days_story" },
  weekly_summary: { feed: "weekly_summary_feed", story: "weekly_summary_story" },
};

export type SnapshotShareCardResult =
  | { error: string; ok: false }
  | { format: ShareCardFormat; height: number; imageUrl: string; ok: true; width: number };

/**
 * Gera (ou reaproveita, por payload_hash) um card que fotografa o ESTADO
 * ATUAL de uma inscricao - metade do ciclo, ultimos 7 dias, resumo semanal,
 * progresso do desafio ou desafio concluido. Reaproveita getProfileOverview
 * (a mesma RPC agregada que o Dashboard ja usa) para os numeros de
 * "estado atual" em vez de uma consulta nova - so o resumo semanal (Parte E
 * item 20) precisa de uma janela de 7 dias que a overview nao calcula.
 * A posse E a disponibilidade (Parte E item 18) sao validadas aqui, nunca
 * confiando num id/kind vindo do cliente sem revalidar no servidor.
 */
export async function generateSnapshotShareCard(
  enrollmentId: string,
  kind: SnapshotProgressCardKind,
  format: ShareCardFormat,
): Promise<SnapshotShareCardResult> {
  const user = await requireAuthUser("/app/dashboard");
  const supabase = await createSupabaseServerClient();

  const overview = await getProfileOverview();
  const enrollment = overview.enrollments.find((row) => row.enrollmentId === enrollmentId);

  if (!enrollment) {
    return { error: "Inscrição não encontrada para este usuário.", ok: false };
  }

  const admin = await Promise.resolve(createSupabaseAdminClient()).catch(() => null);
  if (!admin) {
    return { error: "A configuração segura do servidor ainda não permite gerar artes.", ok: false };
  }

  const { data: profileRow } = await supabase.from("users").select("timezone").eq("id", user.id).maybeSingle();
  const timezone = profileRow?.timezone || "America/Sao_Paulo";
  const today = getDateOnlyInTimeZone(new Date(), timezone);

  // Disponibilidade real por tipo (Parte E item 18) - nunca um card falso
  // via manipulacao de query string/cliente, tudo revalidado aqui.
  const halfwayDay = Math.ceil(enrollment.durationDays / 2);
  const daysRemaining = enrollment.durationDays - enrollment.currentDay;

  if (kind === "halfway" && enrollment.currentDay < halfwayDay) {
    return { error: "Este desafio ainda não chegou à metade do ciclo.", ok: false };
  }

  if (kind === "last_7_days" && (daysRemaining < 0 || daysRemaining > 6)) {
    return { error: "Este desafio não está na última semana do ciclo.", ok: false };
  }

  if (kind === "challenge_progress" && enrollment.completionPercent <= 0) {
    return { error: "Ainda não há progresso registrado neste desafio.", ok: false };
  }

  if (kind === "challenge_completed" && enrollment.status !== "completed") {
    return { error: "Este desafio ainda não foi concluído.", ok: false };
  }

  let daysFinalized: number | null = null;
  if (kind === "halfway" || kind === "challenge_progress" || kind === "challenge_completed") {
    const { count } = await supabase
      .from("daily_logs")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", enrollmentId)
      .eq("status", "finalized");
    daysFinalized = count ?? 0;
  }

  let weekStats: {
    weekAverageCompletion: number | null;
    weekDaysFinalized: number | null;
    weekPoints: number | null;
  } = { weekAverageCompletion: null, weekDaysFinalized: null, weekPoints: null };

  if (kind === "weekly_summary") {
    let windowStart = today;
    for (let i = 0; i < 6; i += 1) windowStart = getPreviousDateOnly(windowStart);

    const { data: weekLogs } = await supabase
      .from("daily_logs")
      .select("completion_percent, points_earned")
      .eq("enrollment_id", enrollmentId)
      .eq("status", "finalized")
      .gte("log_date", windowStart)
      .lte("log_date", today);

    const rows = weekLogs ?? [];
    if (rows.length === 0) {
      return { error: "Não há dias finalizados nesta semana ainda.", ok: false };
    }

    const totalPercent = rows.reduce((sum, row) => sum + (row.completion_percent ?? 0), 0);
    const totalPoints = rows.reduce((sum, row) => sum + (row.points_earned ?? 0), 0);

    weekStats = {
      weekAverageCompletion: totalPercent / rows.length,
      weekDaysFinalized: rows.length,
      weekPoints: totalPoints,
    };
  }

  const content = buildProgressCardContent({
    achievementsUnlocked: enrollment.achievementsUnlocked,
    challengeName: enrollment.challengeName,
    completionPercent: enrollment.completionPercent,
    dayNumber: null,
    daysFinalized,
    daysRemaining,
    durationDays: enrollment.durationDays,
    finalMessage:
      kind === "challenge_completed"
        ? `Você concluiu ${enrollment.challengeName} - ${daysFinalized ?? enrollment.currentDay} ${
            (daysFinalized ?? enrollment.currentDay) === 1 ? "dia finalizado" : "dias finalizados"
          }.`
        : null,
    habitTitles: null,
    kind,
    logDate: today,
    pointsEarned: null,
    pointsTotal: enrollment.pointsTotal,
    previousStreakBest: null,
    streakBest: enrollment.streakBest,
    streakValue: null,
    weekAverageCompletion: weekStats.weekAverageCompletion,
    weekBestStreak: null,
    weekDaysFinalized: weekStats.weekDaysFinalized,
    weekHabitsCompleted: null,
    weekPoints: weekStats.weekPoints,
  });

  const templateSlug = TEMPLATE_SLUGS[kind][format];

  const { data: templateRow, error: templateError } = await supabase
    .from("share_templates")
    .select("id, slug, config")
    .eq("slug", templateSlug)
    .eq("active", true)
    .maybeSingle();

  if (templateError || !templateRow) {
    return { error: "Modelo de arte indisponível no momento.", ok: false };
  }

  const config = templateRow.config as unknown as { format: ShareCardFormat; height: number; width: number };

  const payloadHash = computeProgressSharePayloadHash({
    anchorId: enrollmentId,
    content,
    templateSlug: templateRow.slug ?? templateSlug,
    templateVersion: TEMPLATE_VERSION,
  });

  const { data: existingCard } = await admin
    .from("share_cards")
    .select("id, image_url, payload_hash")
    .eq("snapshot_enrollment_id", enrollmentId)
    .eq("card_type", kind)
    .eq("template_id", templateRow.id)
    .maybeSingle();

  if (existingCard?.payload_hash === payloadHash && existingCard.image_url) {
    return { format, height: config.height, imageUrl: existingCard.image_url, ok: true, width: config.width };
  }

  const storagePath = buildProgressShareCardStoragePath(user.id, enrollmentId, kind, format);

  let imageBuffer: ArrayBuffer;

  try {
    const image = renderProgressShareCardImage(content, config);
    imageBuffer = await image.arrayBuffer();
  } catch {
    await recordSystemError({
      area: "compartilhamentos",
      operation: "snapshot_card_render",
      severity: "error",
      message: "Falha ao renderizar a imagem do card de estado da inscrição.",
      userId: user.id,
      metadata: { format, kind },
    });
    return { error: "Não foi possível gerar a imagem agora.", ok: false };
  }

  const { error: uploadError } = await admin.storage
    .from(SHARE_CARD_BUCKET)
    .upload(storagePath, imageBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    await recordSystemError({
      area: "compartilhamentos",
      operation: "snapshot_card_upload",
      severity: "error",
      message: "Falha ao salvar a imagem do card de estado da inscrição no Storage.",
      userId: user.id,
      metadata: { format, kind },
    });
    return { error: "Não foi possível salvar a imagem gerada.", ok: false };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(SHARE_CARD_BUCKET).getPublicUrl(storagePath);

  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: upsertError } = await admin.from("share_cards").upsert(
    {
      card_type: kind,
      challenge_id: enrollment.challengeId,
      enrollment_id: enrollmentId,
      generated_at: new Date().toISOString(),
      image_url: cacheBustedUrl,
      payload_hash: payloadHash,
      snapshot_enrollment_id: enrollmentId,
      storage_path: storagePath,
      template_id: templateRow.id,
      template_version: TEMPLATE_VERSION,
      user_id: user.id,
      ...(existingCard ? { id: existingCard.id } : {}),
    },
    { onConflict: "snapshot_enrollment_id,card_type,template_id" },
  );

  if (upsertError) {
    await recordSystemError({
      area: "compartilhamentos",
      operation: "snapshot_card_db_upsert",
      severity: "error",
      message: "Falha ao registrar a arte gerada em share_cards.",
      userId: user.id,
      metadata: { format, kind },
    });
    return { error: "Não foi possível registrar a arte gerada.", ok: false };
  }

  return { format, height: config.height, imageUrl: cacheBustedUrl, ok: true, width: config.width };
}
