export type ShareableAchievement = {
  challengeName?: string | null | undefined;
  name: string;
  shareMessage?: string | null | undefined;
  shareTitle?: string | null | undefined;
};

export type AchievementShareText = {
  message: string;
  title: string;
};

/**
 * Builds the text used for Web Share API / clipboard fallback. Privacy
 * rules (non-negotiable): never include email or full legal name - only an
 * optional display name the user already chose to show publicly elsewhere
 * in the product. Passing displayName as undefined/null produces a message
 * with no name at all, which is always a valid, safe choice.
 */
export function getAchievementShareText(
  achievement: ShareableAchievement,
  displayName?: string | null,
): AchievementShareText {
  const title = achievement.shareTitle?.trim() || `Conquista desbloqueada: ${achievement.name}`;

  if (achievement.shareMessage?.trim()) {
    return { message: achievement.shareMessage.trim(), title };
  }

  const who = displayName?.trim() ? `${displayName.trim()} desbloqueou` : "Desbloqueei";
  const where = achievement.challengeName ? ` no ${achievement.challengeName}` : "";

  return {
    message: `${who} a conquista "${achievement.name}"${where} no Projeto 30. Disciplina hoje, liberdade amanhã!`,
    title,
  };
}
