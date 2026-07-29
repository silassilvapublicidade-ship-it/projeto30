import { describe, expect, it } from "vitest";

import {
  MAX_AVATAR_SIZE_BYTES,
  changePasswordSchema,
  profileDetailsSchema,
  validateAvatarUpload,
} from "./profile.schemas";

describe("profileDetailsSchema", () => {
  it("accepts a valid payload and trims whitespace", () => {
    const result = profileDetailsSchema.safeParse({
      city: "  São Paulo  ",
      displayName: "  Ana  ",
      name: "  Ana Beatriz  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        city: "São Paulo",
        displayName: "Ana",
        name: "Ana Beatriz",
      });
    }
  });

  it("treats an empty city as undefined instead of an empty string", () => {
    const result = profileDetailsSchema.safeParse({
      city: "   ",
      displayName: "Ana",
      name: "Ana Beatriz",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.city).toBeUndefined();
    }
  });

  it("rejects a name that is too short", () => {
    const result = profileDetailsSchema.safeParse({
      displayName: "Ana",
      name: "A",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a display name that is too long", () => {
    const result = profileDetailsSchema.safeParse({
      displayName: "A".repeat(81),
      name: "Ana Beatriz",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a city that is too long", () => {
    const result = profileDetailsSchema.safeParse({
      city: "A".repeat(121),
      displayName: "Ana",
      name: "Ana Beatriz",
    });

    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts a valid password change", () => {
    const result = changePasswordSchema.safeParse({
      confirmPassword: "novaSenhaForte123",
      currentPassword: "senhaAntiga1",
      newPassword: "novaSenhaForte123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects when confirmation does not match the new password", () => {
    const result = changePasswordSchema.safeParse({
      confirmPassword: "outraSenha123",
      currentPassword: "senhaAntiga1",
      newPassword: "novaSenhaForte123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((item) => item.path.includes("confirmPassword"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects when the new password is the same as the current password", () => {
    const result = changePasswordSchema.safeParse({
      confirmPassword: "mesmaSenha123",
      currentPassword: "mesmaSenha123",
      newPassword: "mesmaSenha123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a new password shorter than 8 characters", () => {
    const result = changePasswordSchema.safeParse({
      confirmPassword: "curta",
      currentPassword: "senhaAntiga1",
      newPassword: "curta",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty current password", () => {
    const result = changePasswordSchema.safeParse({
      confirmPassword: "novaSenhaForte123",
      currentPassword: "",
      newPassword: "novaSenhaForte123",
    });

    expect(result.success).toBe(false);
  });
});

describe("validateAvatarUpload", () => {
  it("accepts jpeg, png and webp within the size limit", () => {
    expect(validateAvatarUpload({ size: 1024, type: "image/jpeg" })).toEqual({
      ok: true,
      extension: "jpg",
    });
    expect(validateAvatarUpload({ size: 1024, type: "image/png" })).toEqual({
      ok: true,
      extension: "png",
    });
    expect(validateAvatarUpload({ size: 1024, type: "image/webp" })).toEqual({
      ok: true,
      extension: "webp",
    });
  });

  it("rejects an empty file", () => {
    const result = validateAvatarUpload({ size: 0, type: "image/png" });
    expect(result.ok).toBe(false);
  });

  it("rejects a file larger than the configured maximum", () => {
    const result = validateAvatarUpload({
      size: MAX_AVATAR_SIZE_BYTES + 1,
      type: "image/png",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a file exactly at the maximum size", () => {
    const result = validateAvatarUpload({
      size: MAX_AVATAR_SIZE_BYTES,
      type: "image/png",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unsupported MIME type", () => {
    const result = validateAvatarUpload({ size: 1024, type: "application/pdf" });
    expect(result.ok).toBe(false);
  });

  it("rejects an svg (rejected on purpose, avoids stored XSS via inline scripts)", () => {
    const result = validateAvatarUpload({ size: 1024, type: "image/svg+xml" });
    expect(result.ok).toBe(false);
  });
});
