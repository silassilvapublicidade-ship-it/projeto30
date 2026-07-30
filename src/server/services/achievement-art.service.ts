import "server-only";

import {
  buildAchievementCardContent,
  buildShareCardStoragePath,
  computeSharePayloadHash,
} from "@/features/achievements/achievement-art.core";
import {
  TEMPLATE_SLUGS_BY_FORMAT,
  shareCardTemplateConfigSchema,
  type ShareCardFormat,
} from "@/features/achievements/achievement-art.schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderAchievementShareCardImage } from "@/server/rendering/achievement-share-card.render";

import { requireAuthUser } from "./auth-session.service";

const SHARE_CARD_BUCKET = "achievement-share-cards";
const TEMPLATE_VERSION = 1;

export type AchievementShareCardResult =
  | { error: string; ok: false }
  | {
      achievementName: string;
      format: ShareCardFormat;
      height: number;
      imageUrl: string;
      ok: true;
      width: number;
    };

/**
 * Loads an unlocked achievement owned by the current session and, if
 * needed, generates (or reuses) a share card image for it. Never accepts a
 * user id / achievement id from an untrusted source without re-validating
 * ownership server-side - target_user_achievement_id only ever selects a
 * row when it belongs to the authenticated user AND is already unlocked
 * (the query itself is the authorization check, not just a UI affordance).
 */
export async function generateAchievementShareCard(
  userAchievementId: string,
  format: ShareCardFormat,
): Promise<AchievementShareCardResult> {
  const user = await requireAuthUser("/app/conquistas");
  const supabase = await createSupabaseServerClient();

  const { data: unlocked, error: unlockedError } = await supabase
    .from("user_achievements")
    .select(
      "id, unlocked_at, user_id, enrollment_id, achievement:achievements(id,name,description,icon,category,rarity,share_title,share_message,challenge_id,challenge:challenges(name))",
    )
    .eq("id", userAchievementId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (unlockedError || !unlocked || !unlocked.achievement) {
    return { error: "Conquista não encontrada ou não desbloqueada para este usuário.", ok: false };
  }

  const { achievement } = unlocked;

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name || profile?.name || null;

  const { data: templateRow, error: templateError } = await supabase
    .from("share_templates")
    .select("id, slug, config")
    .eq("slug", TEMPLATE_SLUGS_BY_FORMAT[format])
    .eq("active", true)
    .maybeSingle();

  if (templateError || !templateRow) {
    return { error: "Modelo de arte indisponível no momento.", ok: false };
  }

  const parsedConfig = shareCardTemplateConfigSchema.safeParse(templateRow.config);

  if (!parsedConfig.success) {
    return { error: "Configuração do modelo de arte é inválida.", ok: false };
  }

  const content = buildAchievementCardContent(
    {
      category: achievement.category,
      challengeName: achievement.challenge?.name ?? null,
      description: achievement.description,
      name: achievement.name,
      rarity: achievement.rarity,
      shareMessage: achievement.share_message,
      shareTitle: achievement.share_title,
      unlockedAt: unlocked.unlocked_at,
    },
    displayName,
  );

  const payloadHash = computeSharePayloadHash({
    achievementId: achievement.id,
    content,
    templateSlug: templateRow.slug ?? TEMPLATE_SLUGS_BY_FORMAT[format],
    templateVersion: TEMPLATE_VERSION,
  });

  let admin;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { error: "A configuração segura do servidor ainda não permite gerar artes.", ok: false };
  }

  const { data: existingCard } = await admin
    .from("share_cards")
    .select("id, image_url, payload_hash")
    .eq("user_achievement_id", userAchievementId)
    .eq("template_id", templateRow.id)
    .maybeSingle();

  if (existingCard?.payload_hash === payloadHash && existingCard.image_url) {
    return {
      achievementName: achievement.name,
      format,
      height: parsedConfig.data.height,
      imageUrl: existingCard.image_url,
      ok: true,
      width: parsedConfig.data.width,
    };
  }

  const storagePath = buildShareCardStoragePath(user.id, userAchievementId, format);

  let imageBuffer: ArrayBuffer;

  try {
    const image = renderAchievementShareCardImage(content, parsedConfig.data);
    imageBuffer = await image.arrayBuffer();
  } catch {
    return { error: "Não foi possível gerar a imagem agora.", ok: false };
  }

  const { error: uploadError } = await admin.storage
    .from(SHARE_CARD_BUCKET)
    .upload(storagePath, imageBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    return { error: "Não foi possível salvar a imagem gerada.", ok: false };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(SHARE_CARD_BUCKET).getPublicUrl(storagePath);

  const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: upsertError } = await admin.from("share_cards").upsert(
    {
      achievement_id: achievement.id,
      card_type: "achievement",
      challenge_id: achievement.challenge_id,
      enrollment_id: unlocked.enrollment_id,
      generated_at: new Date().toISOString(),
      image_url: cacheBustedUrl,
      payload_hash: payloadHash,
      storage_path: storagePath,
      template_id: templateRow.id,
      template_version: TEMPLATE_VERSION,
      user_achievement_id: userAchievementId,
      user_id: user.id,
      ...(existingCard ? { id: existingCard.id } : {}),
    },
    { onConflict: "user_achievement_id,template_id" },
  );

  if (upsertError) {
    return { error: "Não foi possível registrar a arte gerada.", ok: false };
  }

  return {
    achievementName: achievement.name,
    format,
    height: parsedConfig.data.height,
    imageUrl: cacheBustedUrl,
    ok: true,
    width: parsedConfig.data.width,
  };
}
