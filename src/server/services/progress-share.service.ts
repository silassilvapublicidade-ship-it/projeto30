import "server-only";

import {
  buildProgressCardContent,
  buildProgressShareCardStoragePath,
  computeProgressSharePayloadHash,
} from "@/features/achievements/progress-card.core";
import type { ShareCardFormat } from "@/features/achievements/achievement-art.schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderProgressShareCardImage } from "@/server/rendering/achievement-share-card.render";

import { requireAuthUser } from "./auth-session.service";
import { recordSystemError } from "./system-observability.service";

const SHARE_CARD_BUCKET = "achievement-share-cards";
const TEMPLATE_VERSION = 1;

/** So os 3 tipos ancorados em daily_log_id - os 5 de fotografia da inscricao vivem em enrollment-snapshot-share.service.ts. */
type DayAnchoredProgressCardKind = "day_completed" | "streak_reached" | "streak_record";

const TEMPLATE_SLUGS: Record<DayAnchoredProgressCardKind, Record<ShareCardFormat, string>> = {
  day_completed: { feed: "progress_day_feed", story: "progress_day_story" },
  streak_reached: { feed: "streak_reached_feed", story: "streak_reached_story" },
  streak_record: { feed: "streak_record_feed", story: "streak_record_story" },
};

const CARD_TYPE_BY_KIND: Record<DayAnchoredProgressCardKind, "progress" | "streak_reached" | "streak_record"> = {
  day_completed: "progress",
  streak_reached: "streak_reached",
  streak_record: "streak_record",
};

export type ProgressShareCardResult =
  | { error: string; ok: false }
  | { format: ShareCardFormat; height: number; imageUrl: string; ok: true; width: number };

/**
 * Gera (ou reaproveita, por payload_hash) o card de progresso de UM
 * daily_log especifico - "dia concluido", "novo recorde de sequencia" ou
 * "sequencia em alta". Mesma estrutura de generateAchievementShareCard
 * (achievement-art.service.ts): a query de posse E a autorizacao (so
 * encontra a linha se o daily_log pertencer, via a inscricao, ao usuario
 * autenticado), nunca confia em um id vindo do cliente sem revalidar no
 * servidor.
 */
export async function generateProgressShareCard(
  dailyLogId: string,
  kind: DayAnchoredProgressCardKind,
  format: ShareCardFormat,
): Promise<ProgressShareCardResult> {
  const user = await requireAuthUser("/app/dashboard");
  const supabase = await createSupabaseServerClient();

  const { data: dailyLog, error: dailyLogError } = await supabase
    .from("daily_logs")
    .select(
      "id, log_date, status, points_earned, completion_percent, streak_at_finalize, enrollment_id, challenge_day_id, enrollment:challenge_enrollments!inner(id, user_id, challenge_id, challenge:challenges(name, duration_days))",
    )
    .eq("id", dailyLogId)
    .eq("status", "finalized")
    .eq("enrollment.user_id", user.id)
    .maybeSingle();

  if (dailyLogError || !dailyLog || !dailyLog.enrollment) {
    return { error: "Dia não encontrado ou não finalizado para este usuário.", ok: false };
  }

  if (kind === "streak_record" && dailyLog.streak_at_finalize === null) {
    return { error: "Este dia não representa um novo recorde de sequência.", ok: false };
  }

  // "Sequencia em alta" (Parte E item 18) - so quando ha uma sequencia real
  // (>= 3 dias, mesmo piso ja usado pela conquista "tres-dias-seguidos"),
  // nunca um streak de 1 dia inflado como se fosse um marco.
  if (kind === "streak_reached" && (dailyLog.streak_at_finalize === null || dailyLog.streak_at_finalize < 3)) {
    return { error: "Este dia não representa uma sequência válida para compartilhar.", ok: false };
  }

  const enrollment = dailyLog.enrollment;
  const challengeName = enrollment.challenge?.name ?? "Projeto 30";

  const [{ data: challengeDay }, { data: completedHabitLogs }, { data: previousBestRow }, admin] = await Promise.all([
    dailyLog.challenge_day_id
      ? supabase.from("challenge_days").select("day_number").eq("id", dailyLog.challenge_day_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // habit_logs has no direct FK to habits (only a composite FK to
    // challenge_day_habits) - PostgREST can't embed it in one query. Same
    // two-step pattern already used by getTodayMissionData
    // (member-area.service.ts): habit ids first, titles in a second query.
    supabase.from("habit_logs").select("habit_id").eq("daily_log_id", dailyLog.id).eq("status", "completed"),
    kind === "streak_record"
      ? supabase
          .from("daily_logs")
          .select("streak_at_finalize")
          .eq("enrollment_id", dailyLog.enrollment_id)
          .eq("status", "finalized")
          .not("streak_at_finalize", "is", null)
          .lt("log_date", dailyLog.log_date)
          .order("streak_at_finalize", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    Promise.resolve(createSupabaseAdminClient()).catch(() => null),
  ]);

  if (!admin) {
    return { error: "A configuração segura do servidor ainda não permite gerar artes.", ok: false };
  }

  const completedHabitIds = (completedHabitLogs ?? []).map((row) => row.habit_id);
  const { data: habitRows } =
    completedHabitIds.length > 0
      ? await supabase.from("habits").select("title, sort_order").in("id", completedHabitIds)
      : { data: [] as { sort_order: number; title: string }[] };

  const habitTitles = (habitRows ?? []).sort((a, b) => a.sort_order - b.sort_order).map((habit) => habit.title);

  const content = buildProgressCardContent({
    achievementsUnlocked: null,
    challengeName,
    completionPercent: dailyLog.completion_percent !== null ? Number(dailyLog.completion_percent) : null,
    dayNumber: challengeDay?.day_number ?? null,
    daysFinalized: null,
    daysRemaining: null,
    durationDays: enrollment.challenge?.duration_days ?? null,
    finalMessage: null,
    habitTitles: habitTitles.length > 0 ? habitTitles : null,
    kind,
    logDate: dailyLog.log_date,
    pointsEarned: dailyLog.points_earned,
    pointsTotal: null,
    previousStreakBest: previousBestRow?.streak_at_finalize ?? null,
    streakBest: null,
    streakValue: dailyLog.streak_at_finalize,
    weekAverageCompletion: null,
    weekBestStreak: null,
    weekDaysFinalized: null,
    weekHabitsCompleted: null,
    weekPoints: null,
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
    anchorId: dailyLog.id,
    content,
    templateSlug: templateRow.slug ?? templateSlug,
    templateVersion: TEMPLATE_VERSION,
  });

  const cardType = CARD_TYPE_BY_KIND[kind];

  const { data: existingCard } = await admin
    .from("share_cards")
    .select("id, image_url, payload_hash")
    .eq("daily_log_id", dailyLog.id)
    .eq("card_type", cardType)
    .eq("template_id", templateRow.id)
    .maybeSingle();

  if (existingCard?.payload_hash === payloadHash && existingCard.image_url) {
    return { format, height: config.height, imageUrl: existingCard.image_url, ok: true, width: config.width };
  }

  const storagePath = buildProgressShareCardStoragePath(user.id, dailyLog.id, kind, format);

  let imageBuffer: ArrayBuffer;

  try {
    const image = renderProgressShareCardImage(content, config);
    imageBuffer = await image.arrayBuffer();
  } catch {
    await recordSystemError({
      area: "compartilhamentos",
      operation: "progress_card_render",
      severity: "error",
      message: "Falha ao renderizar a imagem do card de progresso.",
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
      operation: "progress_card_upload",
      severity: "error",
      message: "Falha ao salvar a imagem do card de progresso no Storage.",
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
      card_type: cardType,
      challenge_id: enrollment.challenge_id,
      daily_log_id: dailyLog.id,
      enrollment_id: dailyLog.enrollment_id,
      generated_at: new Date().toISOString(),
      image_url: cacheBustedUrl,
      payload_hash: payloadHash,
      storage_path: storagePath,
      template_id: templateRow.id,
      template_version: TEMPLATE_VERSION,
      user_id: user.id,
      ...(existingCard ? { id: existingCard.id } : {}),
    },
    { onConflict: "daily_log_id,card_type,template_id" },
  );

  if (upsertError) {
    await recordSystemError({
      area: "compartilhamentos",
      operation: "progress_card_db_upsert",
      severity: "error",
      message: "Falha ao registrar a arte gerada em share_cards.",
      userId: user.id,
      metadata: { format, kind },
    });
    return { error: "Não foi possível registrar a arte gerada.", ok: false };
  }

  return { format, height: config.height, imageUrl: cacheBustedUrl, ok: true, width: config.width };
}
