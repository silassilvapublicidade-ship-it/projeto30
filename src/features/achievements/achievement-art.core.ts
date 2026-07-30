import { createHash } from "node:crypto";

import type { ShareCardFormat } from "./achievement-art.schemas";

export type AchievementCardSource = {
  category?: string | null;
  challengeName?: string | null;
  description?: string | null;
  name: string;
  rarity?: string | null;
  shareMessage?: string | null;
  shareTitle?: string | null;
  unlockedAt: string;
};

export type AchievementCardContent = {
  attributionLine: string;
  badgeLabel: string | null;
  challengeLabel: string | null;
  dateLabel: string;
  footerLine: string;
  subtitle: string | null;
  title: string;
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

  const badgeLabel = [achievement.category, achievement.rarity]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ") || null;

  return {
    attributionLine,
    badgeLabel,
    challengeLabel: achievement.challengeName?.trim() || null,
    dateLabel: formatUnlockedDate(achievement.unlockedAt),
    footerLine: "projeto30.app",
    subtitle: achievement.shareMessage?.trim() || achievement.description?.trim() || null,
    title,
  };
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
