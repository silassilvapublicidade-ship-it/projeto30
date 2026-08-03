import { describe, expect, it } from "vitest";

import {
  AUDIENCE_REQUIRES_CHALLENGE,
  AUDIENCE_REQUIRES_HABIT_KEYWORD,
  AUDIENCE_REQUIRES_MIN_STREAK,
  AUDIENCE_REQUIRES_USER,
  campaignFormSchema,
  MAX_NOTIFICATION_IMAGE_SIZE_BYTES,
  NOTIFICATION_AUDIENCE_TYPES,
  REQUIRED_SEND_CONFIRMATION_PHRASE,
  validateNotificationImageUpload,
} from "./notification-campaigns.schemas";
import { MAX_TIP_IMAGE_SIZE_BYTES, validateTipImageUpload } from "./admin-tips.schemas";

const baseInput = {
  audienceType: "all_active_users" as const,
  channelInternal: true,
  channelPush: true,
  destinationType: "hoje" as const,
  message: "Uma mensagem válida",
  title: "Um título válido",
};

describe("campaignFormSchema", () => {
  it("accepts a minimal valid campaign", () => {
    expect(campaignFormSchema.safeParse(baseInput).success).toBe(true);
  });

  it("rejects a title over 120 characters", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, title: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("rejects a message over 500 characters", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, message: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("requires at least one channel", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, channelInternal: false, channelPush: false });
    expect(result.success).toBe(false);
  });

  it("requires challengeId when audienceType is challenge_participants", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, audienceType: "challenge_participants" });
    expect(result.success).toBe(false);
  });

  it("accepts challenge_participants with a challengeId", () => {
    const result = campaignFormSchema.safeParse({
      ...baseInput,
      audienceType: "challenge_participants",
      challengeId: "9d1a8f7e-1234-4abc-8def-1234567890ab",
    });
    expect(result.success).toBe(true);
  });

  it("requires specificUserId when audienceType is specific_user", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, audienceType: "specific_user" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid destinationType outside the shared allowlist", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, destinationType: "external_url" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid audienceType outside the shared allowlist", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, audienceType: "everyone_ever" });
    expect(result.success).toBe(false);
  });

  it("AUDIENCE_REQUIRES_CHALLENGE and AUDIENCE_REQUIRES_USER are disjoint and non-empty", () => {
    expect(AUDIENCE_REQUIRES_CHALLENGE.size).toBeGreaterThan(0);
    expect(AUDIENCE_REQUIRES_USER.size).toBeGreaterThan(0);
    for (const value of AUDIENCE_REQUIRES_CHALLENGE) {
      expect(AUDIENCE_REQUIRES_USER.has(value)).toBe(false);
    }
  });
});

describe("campaignFormSchema - Modulo G, Parte 11 (segmentacoes combinadas)", () => {
  it("NOTIFICATION_AUDIENCE_TYPES includes all 4 new audience types from the brief", () => {
    for (const value of [
      "streak_above_threshold",
      "streak_lost",
      "day_all_habits_completed",
      "habit_keyword_not_completed_today",
    ]) {
      expect(NOTIFICATION_AUDIENCE_TYPES).toContain(value);
    }
  });

  it("requires minStreak when audienceType is streak_above_threshold", () => {
    const result = campaignFormSchema.safeParse({ ...baseInput, audienceType: "streak_above_threshold" });
    expect(result.success).toBe(false);
  });

  it("accepts streak_above_threshold with a minStreak", () => {
    const result = campaignFormSchema.safeParse({
      ...baseInput,
      audienceType: "streak_above_threshold",
      minStreak: 7,
    });
    expect(result.success).toBe(true);
  });

  it("requires habitKeyword when audienceType is habit_keyword_not_completed_today", () => {
    const result = campaignFormSchema.safeParse({
      ...baseInput,
      audienceType: "habit_keyword_not_completed_today",
    });
    expect(result.success).toBe(false);
  });

  it("accepts habit_keyword_not_completed_today with a habitKeyword", () => {
    const result = campaignFormSchema.safeParse({
      ...baseInput,
      audienceType: "habit_keyword_not_completed_today",
      habitKeyword: "treino",
    });
    expect(result.success).toBe(true);
  });

  it("minStreak stays optional (not required) for audience types outside AUDIENCE_REQUIRES_MIN_STREAK - it's the combined-segmentation intersect, not mandatory everywhere", () => {
    expect(AUDIENCE_REQUIRES_MIN_STREAK.has("active_enrollment")).toBe(false);
    const result = campaignFormSchema.safeParse({ ...baseInput, audienceType: "active_enrollment", minStreak: 3 });
    expect(result.success).toBe(true);
  });

  it("AUDIENCE_REQUIRES_MIN_STREAK and AUDIENCE_REQUIRES_HABIT_KEYWORD are disjoint", () => {
    for (const value of AUDIENCE_REQUIRES_MIN_STREAK) {
      expect(AUDIENCE_REQUIRES_HABIT_KEYWORD.has(value)).toBe(false);
    }
  });
});

describe("notification image upload reuses the Dicas pipeline verbatim", () => {
  it("re-exports the exact same validator function, not a re-implementation", () => {
    expect(validateNotificationImageUpload).toBe(validateTipImageUpload);
  });

  it("re-exports the exact same size limit constant", () => {
    expect(MAX_NOTIFICATION_IMAGE_SIZE_BYTES).toBe(MAX_TIP_IMAGE_SIZE_BYTES);
  });
});

describe("REQUIRED_SEND_CONFIRMATION_PHRASE", () => {
  it("is the exact literal phrase the briefing specified, not a placeholder", () => {
    expect(REQUIRED_SEND_CONFIRMATION_PHRASE).toBe("ENVIAR NOTIFICAÇÃO");
  });
});
