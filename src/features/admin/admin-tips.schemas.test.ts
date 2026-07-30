import { describe, expect, it } from "vitest";

import {
  isRecommendedTipImageRatio,
  MAX_TIP_IMAGE_SIZE_BYTES,
  TIP_CATEGORIES,
  tipFormSchema,
  validateTipImageUpload,
} from "./admin-tips.schemas";

describe("validateTipImageUpload", () => {
  it("rejects an empty file", () => {
    const result = validateTipImageUpload({ size: 0, type: "image/png" });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const result = validateTipImageUpload({
      size: MAX_TIP_IMAGE_SIZE_BYTES + 1,
      type: "image/png",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a file exactly at the size limit", () => {
    const result = validateTipImageUpload({ size: MAX_TIP_IMAGE_SIZE_BYTES, type: "image/png" });
    expect(result.ok).toBe(true);
  });

  it("accepts jpeg, png and webp", () => {
    expect(validateTipImageUpload({ size: 1000, type: "image/jpeg" }).ok).toBe(true);
    expect(validateTipImageUpload({ size: 1000, type: "image/png" }).ok).toBe(true);
    expect(validateTipImageUpload({ size: 1000, type: "image/webp" }).ok).toBe(true);
  });

  it("rejects SVG explicitly, even though it's an image MIME type", () => {
    const result = validateTipImageUpload({ size: 1000, type: "image/svg+xml" });
    expect(result.ok).toBe(false);
  });

  it("rejects an executable disguised with an image-like MIME type", () => {
    const result = validateTipImageUpload({ size: 1000, type: "application/x-msdownload" });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-image MIME type entirely", () => {
    const result = validateTipImageUpload({ size: 1000, type: "text/html" });
    expect(result.ok).toBe(false);
  });
});

describe("isRecommendedTipImageRatio", () => {
  it("accepts the exact recommended 1080x1350 (4:5) dimensions", () => {
    expect(isRecommendedTipImageRatio(1080, 1350)).toBe(true);
  });

  it("accepts a close variant within tolerance", () => {
    expect(isRecommendedTipImageRatio(1000, 1250)).toBe(true);
  });

  it("flags a square image as off-ratio", () => {
    expect(isRecommendedTipImageRatio(1000, 1000)).toBe(false);
  });

  it("flags a wide landscape image as off-ratio", () => {
    expect(isRecommendedTipImageRatio(1920, 1080)).toBe(false);
  });

  it("never throws on zero/negative dimensions, just returns false", () => {
    expect(isRecommendedTipImageRatio(0, 0)).toBe(false);
    expect(isRecommendedTipImageRatio(-100, 200)).toBe(false);
  });
});

describe("tipFormSchema", () => {
  const validBase = {
    category: TIP_CATEGORIES[0],
    displayOrder: "0",
    slug: "dica-de-teste",
    title: "Uma dica de teste",
  };

  it("accepts a minimal valid input", () => {
    expect(tipFormSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects a category outside the controlled list", () => {
    const result = tipFormSchema.safeParse({ ...validBase, category: "Categoria Inventada" });
    expect(result.success).toBe(false);
  });

  it("rejects a slug with uppercase letters or spaces", () => {
    expect(tipFormSchema.safeParse({ ...validBase, slug: "Dica Invalida" }).success).toBe(false);
  });

  it("rejects endsAt earlier than startsAt", () => {
    const result = tipFormSchema.safeParse({
      ...validBase,
      endsAt: "2026-01-01T00:00",
      startsAt: "2026-06-01T00:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts endsAt equal to or after startsAt", () => {
    const result = tipFormSchema.safeParse({
      ...validBase,
      endsAt: "2026-06-01T00:00",
      startsAt: "2026-01-01T00:00",
    });
    expect(result.success).toBe(true);
  });
});
