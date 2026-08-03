import { createHash } from "node:crypto";

import { normalizeRarity, RARITY_TIERS, type RarityTier } from "./achievement-rarity.core";
import { getSceneForAchievement, type SceneId } from "./achievement-scene.core";
import type { ShareCardFormat } from "./achievement-art.schemas";

export type AchievementCardSource = {
  achievementNumber?: number | null;
  achievementTotal?: number | null;
  category?: string | null;
  challengeName?: string | null;
  description?: string | null;
  icon?: string | null;
  name: string;
  rarity?: string | null;
  shareMessage?: string | null;
  shareTitle?: string | null;
  slug?: string | null;
  unlockedAt: string;
  unlockedPercent?: number | null;
};

export type AchievementCardContent = {
  attributionLine: string;
  badgeLabel: string | null;
  challengeLabel: string | null;
  dateLabel: string;
  footerLine: string;
  icon: string | null;
  numberLabel: string | null;
  rarityLabel: string;
  rarityTier: RarityTier;
  sceneId: SceneId;
  subtitle: string | null;
  title: string;
  unlockedPercentLabel: string | null;
};

/**
 * Pure content-building step, separate from JSX rendering (next/og). Privacy
 * rule (non-negotiable, mirrors achievement-sharing.core.ts): only an
 * already-public displayName is ever accepted - never email, never the
 * user's full legal name. Absent displayName produces a fully valid,
 * anonymous-looking card.
 */
export function buildAchievementCardContent(
  achievement: AchievementCardSource,
  displayName?: string | null,
): AchievementCardContent {
  const title = achievement.shareTitle?.trim() || achievement.name;
  const trimmedDisplayName = displayName?.trim();

  const attributionLine = trimmedDisplayName
    ? `${trimmedDisplayName} desbloqueou`
    : "Conquista desbloqueada";

  const rarityTier = normalizeRarity(achievement.rarity);

  // Uses the normalized tier label (Bronze/Prata/Ouro/Lendária), not the raw
  // admin-entered rarity string - the whole point of a tier system is a
  // consistent label everywhere on the card, not whatever casing/accent an
  // admin happened to type ("comum", "Comum", "bronze"...).
  const badgeLabel =
    [achievement.category?.trim(), achievement.rarity ? RARITY_TIERS[rarityTier].label : null]
      .filter((value): value is string => Boolean(value))
      .join(" · ") || null;

  const numberLabel =
    achievement.achievementNumber && achievement.achievementTotal
      ? `Nº ${String(achievement.achievementNumber).padStart(2, "0")} de ${achievement.achievementTotal}`
      : null;

  const unlockedPercentLabel =
    typeof achievement.unlockedPercent === "number" && Number.isFinite(achievement.unlockedPercent)
      ? `${formatPercent(achievement.unlockedPercent)} dos participantes desbloquearam`
      : null;

  return {
    attributionLine,
    badgeLabel,
    challengeLabel: achievement.challengeName?.trim() || null,
    dateLabel: formatUnlockedDate(achievement.unlockedAt),
    footerLine: "projeto30.app",
    icon: achievement.icon?.trim() || null,
    numberLabel,
    rarityLabel: RARITY_TIERS[rarityTier].label,
    rarityTier,
    sceneId: getSceneForAchievement(achievement.slug),
    subtitle: achievement.shareMessage?.trim() || achievement.description?.trim() || null,
    title,
    unlockedPercentLabel,
  };
}

function formatPercent(value: number) {
  const clamped = Math.min(100, Math.max(0, value));
  const rounded = clamped < 1 && clamped > 0 ? Math.round(clamped * 10) / 10 : Math.round(clamped);
  return `${rounded}%`;
}

function formatUnlockedDate(isoDate: string): string {
  const parsed = new Date(isoDate);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export type SharePayloadHashInput = {
  achievementId: string;
  content: AchievementCardContent;
  templateSlug: string;
  templateVersion: number;
};

/**
 * Deterministic hash of everything that actually gets rendered onto the
 * card, plus the template identity/version. Used to decide whether an
 * existing share_cards row can be reused as-is (hash unchanged) or must be
 * regenerated (display name changed, achievement copy changed, or the
 * template itself changed) - see 0014_achievement_share_cards.sql.
 */
export function computeSharePayloadHash(input: SharePayloadHashInput): string {
  const normalized = JSON.stringify({
    achievementId: input.achievementId,
    content: input.content,
    templateSlug: input.templateSlug,
    templateVersion: input.templateVersion,
  });

  return createHash("sha256").update(normalized).digest("hex");
}

export function buildShareCardStoragePath(
  userId: string,
  userAchievementId: string,
  format: ShareCardFormat,
): string {
  return `achievements/${userId}/${userAchievementId}/${format}.png`;
}
