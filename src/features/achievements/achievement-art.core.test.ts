import { describe, expect, it } from "vitest";

import {
  buildAchievementCardContent,
  buildShareCardStoragePath,
  computeSharePayloadHash,
} from "./achievement-art.core";

const baseAchievement = {
  category: "Consistência",
  challengeName: "Desafio de Agosto",
  description: "Complete seu primeiro hábito.",
  name: "Primeiro hábito",
  rarity: "comum",
  shareMessage: null,
  shareTitle: null,
  unlockedAt: "2026-07-15T10:00:00.000Z",
};

describe("buildAchievementCardContent", () => {
  it("uses the display name when present", () => {
    const content = buildAchievementCardContent(baseAchievement, "Ana");
    expect(content.attributionLine).toBe("Ana desbloqueou");
  });

  it("produces a fully valid card with no display name at all", () => {
    const content = buildAchievementCardContent(baseAchievement, null);
    expect(content.attributionLine).toBe("Conquista desbloqueada");
    expect(content.attributionLine).not.toContain("undefined");
    expect(content.attributionLine).not.toContain("null");
  });

  it("never injects an email address on its own when no display name is given", () => {
    // The privacy contract (never email, only an optional already-public
    // display name) is enforced by the caller (achievement-art.service.ts
    // only ever passes profile.display_name/name here, never email) - this
    // asserts the content builder itself introduces no email-like text from
    // the achievement fields alone.
    const content = buildAchievementCardContent(baseAchievement, null);
    expect(JSON.stringify(content)).not.toContain("@");
  });

  it("prefers shareTitle/shareMessage over the raw name/description", () => {
    const content = buildAchievementCardContent(
      { ...baseAchievement, shareMessage: "Mensagem customizada.", shareTitle: "Título customizado" },
      "Ana",
    );
    expect(content.title).toBe("Título customizado");
    expect(content.subtitle).toBe("Mensagem customizada.");
  });

  it("joins category and rarity into a single badge label", () => {
    const content = buildAchievementCardContent(baseAchievement, "Ana");
    expect(content.badgeLabel).toBe("Consistência · comum");
  });

  it("omits the badge label when neither category nor rarity is set", () => {
    const content = buildAchievementCardContent(
      { ...baseAchievement, category: null, rarity: null },
      "Ana",
    );
    expect(content.badgeLabel).toBeNull();
  });

  it("formats the unlocked date in pt-BR", () => {
    const content = buildAchievementCardContent(baseAchievement, "Ana");
    expect(content.dateLabel).toMatch(/2026/);
  });
});

describe("computeSharePayloadHash", () => {
  const content = buildAchievementCardContent(baseAchievement, "Ana");

  it("is deterministic for the same input", () => {
    const a = computeSharePayloadHash({
      achievementId: "achv-1",
      content,
      templateSlug: "achievement_story",
      templateVersion: 1,
    });
    const b = computeSharePayloadHash({
      achievementId: "achv-1",
      content,
      templateSlug: "achievement_story",
      templateVersion: 1,
    });
    expect(a).toBe(b);
  });

  it("changes when the display name (and therefore content) changes", () => {
    const other = buildAchievementCardContent(baseAchievement, "Bruno");
    const a = computeSharePayloadHash({
      achievementId: "achv-1",
      content,
      templateSlug: "achievement_story",
      templateVersion: 1,
    });
    const b = computeSharePayloadHash({
      achievementId: "achv-1",
      content: other,
      templateSlug: "achievement_story",
      templateVersion: 1,
    });
    expect(a).not.toBe(b);
  });

  it("changes when the template version changes", () => {
    const a = computeSharePayloadHash({
      achievementId: "achv-1",
      content,
      templateSlug: "achievement_story",
      templateVersion: 1,
    });
    const b = computeSharePayloadHash({
      achievementId: "achv-1",
      content,
      templateSlug: "achievement_story",
      templateVersion: 2,
    });
    expect(a).not.toBe(b);
  });

  it("changes when the template slug (format) changes", () => {
    const a = computeSharePayloadHash({
      achievementId: "achv-1",
      content,
      templateSlug: "achievement_story",
      templateVersion: 1,
    });
    const b = computeSharePayloadHash({
      achievementId: "achv-1",
      content,
      templateSlug: "achievement_feed",
      templateVersion: 1,
    });
    expect(a).not.toBe(b);
  });
});

describe("buildShareCardStoragePath", () => {
  it("builds a deterministic path scoped by user and unlock event, without email", () => {
    const path = buildShareCardStoragePath("user-123", "unlock-456", "story");
    expect(path).toBe("achievements/user-123/unlock-456/story.png");
    expect(path).not.toContain("@");
  });
});
