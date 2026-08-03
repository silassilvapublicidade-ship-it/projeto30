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

  it("joins category and the normalized rarity tier label into a single badge label - not the raw admin-entered rarity text", () => {
    const content = buildAchievementCardContent(baseAchievement, "Ana");
    expect(content.badgeLabel).toBe("Consistência · Bronze");
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

  it("normalizes rarity into a tier and picks a scene from slug", () => {
    const content = buildAchievementCardContent(
      { ...baseAchievement, rarity: "épica", slug: "primeiro-dia" },
      "Ana",
    );
    expect(content.rarityTier).toBe("ouro");
    expect(content.rarityLabel).toBe("Ouro");
    expect(content.sceneId).toBe("sunrise-glow");
  });

  it("defaults to the bronze tier and the generic scene when rarity/slug are absent", () => {
    const content = buildAchievementCardContent({ ...baseAchievement, rarity: null, slug: null }, "Ana");
    expect(content.rarityTier).toBe("bronze");
    expect(content.sceneId).toBe("soft-light");
  });

  it("builds the achievement number label only when both number and total are known", () => {
    const withNumber = buildAchievementCardContent(
      { ...baseAchievement, achievementNumber: 3, achievementTotal: 10 },
      "Ana",
    );
    expect(withNumber.numberLabel).toBe("Nº 03 de 10");

    const withoutNumber = buildAchievementCardContent(baseAchievement, "Ana");
    expect(withoutNumber.numberLabel).toBeNull();
  });

  it("formats the unlocked-percent label, and omits it entirely when unknown", () => {
    const withPercent = buildAchievementCardContent({ ...baseAchievement, unlockedPercent: 12.4 }, "Ana");
    expect(withPercent.unlockedPercentLabel).toBe("12% dos participantes desbloquearam");

    const withoutPercent = buildAchievementCardContent(baseAchievement, "Ana");
    expect(withoutPercent.unlockedPercentLabel).toBeNull();
  });

  it("carries the icon through untouched, trimmed", () => {
    const content = buildAchievementCardContent({ ...baseAchievement, icon: "  sunrise  " }, "Ana");
    expect(content.icon).toBe("sunrise");
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
