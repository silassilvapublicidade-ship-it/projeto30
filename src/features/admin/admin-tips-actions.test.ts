import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("admin-tips.actions - authorization", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("every directly-implemented action requires an admin session before touching content_items", () => {
    const actionNames = [
      "createTipDraftAction",
      "updateTipAction",
      "uploadTipImageAction",
      "removeTipImageAction",
      "publishTipAction",
      "duplicateTipAsDraftAction",
      "deleteTipAction",
    ];

    for (const name of actionNames) {
      const start = source.indexOf(`export async function ${name}`);
      expect(start, `${name} should exist`).toBeGreaterThan(-1);
      const body = source.slice(start, start + 600);
      expect(body, `${name} should call requireAdminUser()`).toContain(
        "await requireAdminUser();",
      );
    }
  });

  it("unpublishTipAction and archiveTipAction delegate to a helper that itself requires admin", () => {
    expect(source).toContain("export async function unpublishTipAction(formData: FormData) {");
    expect(source).toContain("export async function archiveTipAction(formData: FormData) {");
    const helperStart = source.indexOf("async function transitionTipStatus");
    const helperBody = source.slice(helperStart, helperStart + 300);
    expect(helperBody).toContain("await requireAdminUser();");
  });

  it("every mutation scopes by type = 'tip', never touching other content_items rows", () => {
    const occurrences = source.split('.eq("type", TIP_TYPE)').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(5);
  });
});

describe("admin-tips.actions - publish requires an uploaded image", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("blocks publishing when media_url is null", () => {
    const start = source.indexOf("export async function publishTipAction");
    const body = source.slice(start, start + 900);
    expect(body).toContain("if (!tip.media_url)");
    expect(body).toContain("publish-needs-image");
  });

  it("preserves the original published_at instead of overwriting it on re-publish", () => {
    const start = source.indexOf("export async function publishTipAction");
    const body = source.slice(start, start + 900);
    expect(body).toContain("published_at: tip.published_at ?? new Date().toISOString()");
  });
});

describe("admin-tips.actions - unpublish/archive preserve the record and the image", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("unpublish only changes status back to draft, never deletes the row or clears media_url", () => {
    const start = source.indexOf("export async function unpublishTipAction");
    const body = source.slice(start, start + 500);
    expect(body).toContain('transitionTipStatus(formData, "draft"');
  });

  it("the shared status-transition helper never touches media_url", () => {
    const start = source.indexOf("async function transitionTipStatus");
    const helperEnd = source.indexOf("\n}", start);
    const body = source.slice(start, helperEnd);
    expect(body).not.toContain("media_url");
    expect(body).toContain(".update({ status, updated_at: new Date().toISOString() })");
  });
});

describe("admin-tips.actions - image upload optimizes to WebP server-side", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("converts the uploaded image to WebP via sharp before storing", () => {
    const start = source.indexOf("export async function uploadTipImageAction");
    const body = source.slice(start, start + 2000);
    expect(body).toContain("sharp(originalBuffer)");
    expect(body).toContain('.webp({ quality: 85 })');
    expect(body).toContain('contentType = "image/webp"');
  });

  it("falls back to the original validated file if sharp conversion fails, instead of blocking the upload", () => {
    const start = source.indexOf("export async function uploadTipImageAction");
    const body = source.slice(start, start + 2000);
    expect(body).toMatch(/catch\s*\{/);
  });

  it("removes stale files under the tip's own storage prefix before uploading the new one", () => {
    const start = source.indexOf("export async function uploadTipImageAction");
    const body = source.slice(start, start + 1200);
    expect(body).toContain('storage.from("tip-cards").list(`tips/${tipId}`)');
    expect(body).toContain('storage.from("tip-cards").remove(staleFiles)');
  });

  it("validates the file (MIME/size) before ever touching storage", () => {
    const start = source.indexOf("export async function uploadTipImageAction");
    const validateIndex = source.indexOf("validateTipImageUpload(", start);
    const storageIndex = source.indexOf("supabase.storage", start);
    expect(validateIndex).toBeGreaterThan(-1);
    expect(validateIndex).toBeLessThan(storageIndex);
  });
});

describe("admin-tips.actions - deletion removes only this tip's own storage prefix", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("lists and removes files scoped to tips/{tipId}, never a bucket-wide operation", () => {
    const start = source.indexOf("export async function deleteTipAction");
    const body = source.slice(start, start + 900);
    expect(body).toContain("storage.from(\"tip-cards\").list(`tips/${tipId.data}`)");
    expect(body).toContain("`tips/${tipId.data}/${item.name}`");
  });

  it("deletes the database row before attempting storage cleanup", () => {
    const start = source.indexOf("export async function deleteTipAction");
    const body = source.slice(start, start + 900);
    const deleteRowIndex = body.indexOf('.from("content_items")\n    .delete()');
    const listFilesIndex = body.indexOf("storage.from(\"tip-cards\").list");
    expect(deleteRowIndex).toBeGreaterThan(-1);
    expect(deleteRowIndex).toBeLessThan(listFilesIndex);
  });
});

describe("admin-tips.actions - duplicate never copies the display window or the image as already-live", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("the duplicated row always starts as draft with a new slug", () => {
    const start = source.indexOf("export async function duplicateTipAsDraftAction");
    const body = source.slice(start, start + 1300);
    expect(body).toContain('status: "draft"');
    expect(body).toContain("newSlug");
  });

  it("does not carry over media_url, starts_at, ends_at or published_at as insert keys into the copy", () => {
    const start = source.indexOf("export async function duplicateTipAsDraftAction");
    const insertStart = source.indexOf(".insert({", start);
    const insertEnd = source.indexOf("\n  });", insertStart);
    const insertBody = source.slice(insertStart, insertEnd);
    // Line-anchored (`key:` at the start of a line, ignoring indentation) so
    // this only checks actual object keys, not prose mentioning the same
    // field names inside an explanatory comment within the same block.
    expect(insertBody).not.toMatch(/^\s*media_url\s*:/m);
    expect(insertBody).not.toMatch(/^\s*starts_at\s*:/m);
    expect(insertBody).not.toMatch(/^\s*ends_at\s*:/m);
    expect(insertBody).not.toMatch(/^\s*published_at\s*:/m);
  });
});

describe("admin-tips.actions - cache revalidation", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("revalidates the admin list, the editor page and the public gallery after every mutation", () => {
    const helperStart = source.indexOf("function revalidateTipPaths");
    const helperBody = source.slice(helperStart, helperStart + 300);
    expect(helperBody).toContain('revalidatePath("/admin/dicas")');
    expect(helperBody).toContain("revalidatePath(tipEditorPath(tipId))");
    expect(helperBody).toContain('revalidatePath("/app/dicas")');
  });

  it("never uses force-dynamic just to avoid revalidation", () => {
    expect(source).not.toContain("force-dynamic");
  });
});
