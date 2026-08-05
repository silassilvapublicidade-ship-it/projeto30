import { describe, expect, it } from "vitest";

import {
  classifyBucketObjects,
  computeStorageHealthStatus,
  extractStoragePathFromPublicUrl,
  isStorageBucketId,
  STORAGE_BUCKETS,
  summarizeBucketFindings,
  type StorageObjectInfo,
} from "./storage-audit.core";

describe("STORAGE_BUCKETS", () => {
  it("lists exactly the 5 real buckets created by migration (never invented)", () => {
    expect([...STORAGE_BUCKETS].sort()).toEqual(
      ["achievement-share-cards", "avatars", "challenge-covers", "notification-images", "tip-cards"].sort(),
    );
  });

  it("isStorageBucketId rejects an unknown bucket name", () => {
    expect(isStorageBucketId("random-bucket")).toBe(false);
    expect(isStorageBucketId("avatars")).toBe(true);
  });
});

describe("extractStoragePathFromPublicUrl", () => {
  it("extracts the path and strips a cache-busting query string (notification-images pattern)", () => {
    const url = "https://xyz.supabase.co/storage/v1/object/public/notification-images/campaigns/abc/123.webp?v=456";
    expect(extractStoragePathFromPublicUrl(url, "notification-images")).toBe("campaigns/abc/123.webp");
  });

  it("returns null for a URL that doesn't belong to this bucket - an external avatar_url is not an orphan", () => {
    expect(extractStoragePathFromPublicUrl("https://example.com/my-photo.png", "avatars")).toBeNull();
  });

  it("returns null when the URL points at a different bucket", () => {
    const url = "https://xyz.supabase.co/storage/v1/object/public/avatars/user-1/profile.png";
    expect(extractStoragePathFromPublicUrl(url, "challenge-covers")).toBeNull();
  });
});

function object(path: string, overrides: Partial<StorageObjectInfo> = {}): StorageObjectInfo {
  return { bucket: "avatars", path, sizeBytes: 1024, mimeType: "image/png", createdAt: "2026-01-01T00:00:00Z", ...overrides };
}

describe("classifyBucketObjects - worked examples per the user's own scenarios", () => {
  it("avatars: an old replaced file (real object, no longer referenced) is an orphan", () => {
    const objects = [object("user-1/profile.png"), object("user-1/profile-old.jpg")];
    const referenced = new Set(["user-1/profile.png"]);
    const findings = classifyBucketObjects("avatars", objects, referenced, "users.avatar_url");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toBe("user-1/profile-old.jpg");
    expect(findings[0]?.classification).toBe("orphan");
    expect(findings[0]?.diagnosticCode).toBe("STOR-ORPHAN-NO-DB-REFERENCE");
  });

  it("a referenced file is never classified as anything", () => {
    const objects = [object("user-1/profile.png")];
    const referenced = new Set(["user-1/profile.png"]);
    expect(classifyBucketObjects("avatars", objects, referenced, "users.avatar_url")).toHaveLength(0);
  });

  it("a DB record pointing at a missing file is a missing_reference, not an orphan", () => {
    const objects: StorageObjectInfo[] = [];
    const referenced = new Set(["challenges/xyz/cover.png"]);
    const findings = classifyBucketObjects("challenge-covers", objects, referenced, "challenges.cover_image_url");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.classification).toBe("missing_reference");
    expect(findings[0]?.diagnosticCode).toBe("STOR-MISSING-FILE-FOR-REFERENCE");
  });

  it("a zero-byte referenced object is suspicious, not orphan", () => {
    const objects = [object("tips/1/1.png", { bucket: "tip-cards", sizeBytes: 0 })];
    const referenced = new Set(["tips/1/1.png"]);
    const findings = classifyBucketObjects("tip-cards", objects, referenced, "content_items.image_storage_path");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.classification).toBe("suspicious");
    expect(findings[0]?.diagnosticCode).toBe("STOR-SUSPICIOUS-ZERO-BYTE");
  });

  it("an unexpected MIME type on a referenced object is suspicious", () => {
    const objects = [object("tips/1/1.png", { bucket: "tip-cards", mimeType: "application/pdf" })];
    const referenced = new Set(["tips/1/1.png"]);
    const findings = classifyBucketObjects("tip-cards", objects, referenced, "content_items.image_storage_path");

    expect(findings[0]?.diagnosticCode).toBe("STOR-SUSPICIOUS-UNEXPECTED-MIME");
  });

  it("a referenced object outside the expected prefix is suspicious (e.g. a fixture dropped at bucket root)", () => {
    const objects = [object("unexpected-root-file.png", { bucket: "tip-cards" })];
    const referenced = new Set(["unexpected-root-file.png"]);
    const findings = classifyBucketObjects("tip-cards", objects, referenced, "content_items.image_storage_path");

    expect(findings[0]?.diagnosticCode).toBe("STOR-SUSPICIOUS-UNEXPECTED-PREFIX");
  });

  it("achievement-share-cards accepts both progress/ and achievements/ prefixes - two path conventions, one bucket", () => {
    const objects = [
      object("achievements/u1/ua1/story.png", { bucket: "achievement-share-cards", mimeType: "image/png" }),
      object("progress/u1/anchor1/story-story.png", { bucket: "achievement-share-cards", mimeType: "image/png" }),
    ];
    const referenced = new Set(["achievements/u1/ua1/story.png", "progress/u1/anchor1/story-story.png"]);
    expect(classifyBucketObjects("achievement-share-cards", objects, referenced, "share_cards.storage_path")).toHaveLength(0);
  });
});

describe("summarizeBucketFindings", () => {
  it("recommends investigating missing references above cleaning orphans", () => {
    const objects: StorageObjectInfo[] = [];
    const referenced = new Set(["challenges/xyz/cover.png"]);
    const findings = classifyBucketObjects("challenge-covers", objects, referenced, "challenges.cover_image_url");
    const summary = summarizeBucketFindings("challenge-covers", objects, findings);

    expect(summary.missingReferenceCount).toBe(1);
    expect(summary.recommendedAction).toMatch(/registros apontando/i);
  });
});

describe("computeStorageHealthStatus - never classified by volume alone", () => {
  it("a large number of orphans with zero missing references/suspicious is only 'atencao', not 'critico'", () => {
    expect(computeStorageHealthStatus({ missingReferenceCount: 0, orphanCount: 500, suspiciousCount: 0 })).toBe("atencao");
  });

  it("a single missing reference outranks any number of orphans - broken reference is the worst signal", () => {
    expect(computeStorageHealthStatus({ missingReferenceCount: 1, orphanCount: 0, suspiciousCount: 0 })).toBe("critico");
  });

  it("suspicious findings alone are 'degradado', between orphan-only and missing-reference", () => {
    expect(computeStorageHealthStatus({ missingReferenceCount: 0, orphanCount: 0, suspiciousCount: 3 })).toBe("degradado");
  });

  it("nothing found is saudavel", () => {
    expect(computeStorageHealthStatus({ missingReferenceCount: 0, orphanCount: 0, suspiciousCount: 0 })).toBe("saudavel");
  });
});
