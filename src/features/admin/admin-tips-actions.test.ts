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
      "createTipCardAction",
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

  it("every mutation scopes by content_type = 'tip_card', never touching other content_items rows", () => {
    const occurrences = source.split('.eq("content_type", TIP_CONTENT_TYPE)').length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(5);
  });
});

describe("admin-tips.actions - single-screen creation (image + fields together)", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("requires an image, a title and a category before inserting", () => {
    const start = source.indexOf("export async function createTipCardAction");
    const body = source.slice(start, start + 1600);
    expect(body).toContain('fieldErrors.title = ["Informe um título com pelo menos 3 caracteres."];');
    expect(body).toContain('fieldErrors.category = ["Selecione uma categoria."];');
    expect(body).toContain('fieldErrors.image = ["Envie uma imagem para o card."];');
  });

  it("generates the id upfront so the image can upload to its final tips/{id}/ path before the row exists", () => {
    const start = source.indexOf("export async function createTipCardAction");
    const body = source.slice(start, start + 4500);
    expect(body).toContain("const newId = randomUUID();");
    expect(body).toContain("`tips/${newId}/");
    expect(body).toContain("id: newId,");
  });

  it("sets status/published_at from the clicked submit button's intent value", () => {
    const start = source.indexOf("export async function createTipCardAction");
    const body = source.slice(start, start + 4500);
    expect(body).toContain('formData.get("intent") === "publish"');
    expect(body).toContain('status: intent === "publish" ? "published" : "draft"');
    expect(body).toContain(
      'published_at: intent === "publish" ? new Date().toISOString() : null',
    );
  });

  it("cleans up the uploaded file if the row insert fails, never leaving an orphan", () => {
    const start = source.indexOf("export async function createTipCardAction");
    const body = source.slice(start, start + 4000);
    expect(body).toContain("if (insertError) {");
    const insertErrorIndex = body.indexOf("if (insertError) {");
    const cleanupIndex = body.indexOf("storage.from(\"tip-cards\").remove([storagePath])", insertErrorIndex);
    expect(cleanupIndex).toBeGreaterThan(insertErrorIndex);
  });

  it("stamps created_by with the acting admin's id", () => {
    const start = source.indexOf("export async function createTipCardAction");
    const body = source.slice(start, start + 4500);
    expect(body).toContain("created_by: admin.id,");
  });
});

describe("admin-tips.actions - publish requires image + title + category", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("blocks publishing when image_url, title or category is missing", () => {
    const start = source.indexOf("export async function publishTipAction");
    const body = source.slice(start, start + 1200);
    expect(body).toContain("if (!tip.image_url || !tip.title || !tip.category)");
    expect(body).toContain("publish-needs-image");
  });

  it("preserves the original published_at instead of overwriting it on re-publish (draft or archived)", () => {
    const start = source.indexOf("export async function publishTipAction");
    const body = source.slice(start, start + 1200);
    expect(body).toContain("published_at: tip.published_at ?? new Date().toISOString()");
  });

  it("has no status precondition of its own, so the same action serves both Publicar (draft) and Publicar novamente (archived)", () => {
    const start = source.indexOf("export async function publishTipAction");
    const nextFn = source.indexOf("async function transitionTipStatus");
    const body = source.slice(start, nextFn);
    expect(body).not.toMatch(/status\s*(===|!==)\s*"(draft|archived)"/);
  });
});

describe("admin-tips.actions - unpublish/archive preserve the record and the image", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("unpublish only changes status back to draft, never deletes the row or clears image_url", () => {
    const start = source.indexOf("export async function unpublishTipAction");
    const body = source.slice(start, start + 500);
    expect(body).toContain('transitionTipStatus(formData, "draft"');
  });

  it("the shared status-transition helper never touches image_url", () => {
    const start = source.indexOf("async function transitionTipStatus");
    const helperEnd = source.indexOf("\n}", start);
    const body = source.slice(start, helperEnd);
    expect(body).not.toContain("image_url");
    expect(body).toContain(
      ".update({ status, updated_at: new Date().toISOString(), updated_by: admin.id })",
    );
  });
});

describe("admin-tips.actions - image upload optimizes to WebP server-side", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("converts the uploaded image to WebP via a shared sharp helper before storing", () => {
    const helperStart = source.indexOf("async function optimizeTipImage");
    const helperBody = source.slice(helperStart, helperStart + 900);
    expect(helperBody).toContain("sharp(originalBuffer)");
    expect(helperBody).toContain(".webp({ quality: 85 })");
    expect(helperBody).toContain('contentType: "image/webp"');
  });

  it("falls back to the original validated bytes if sharp conversion fails, instead of blocking the upload", () => {
    const helperStart = source.indexOf("async function optimizeTipImage");
    const helperBody = source.slice(helperStart, helperStart + 900);
    expect(helperBody).toMatch(/catch\s*\{/);
    expect(helperBody).toContain("buffer: originalBuffer");
  });

  it("reports a ratio warning without ever blocking the upload over it", () => {
    const helperStart = source.indexOf("async function optimizeTipImage");
    const helperBody = source.slice(helperStart, helperStart + 900);
    expect(helperBody).toContain("isRecommendedTipImageRatio(metadata.width, metadata.height)");
  });

  it("uploads the new file and confirms the row update before removing the previous file (never delete-then-upload)", () => {
    const start = source.indexOf("export async function uploadTipImageAction");
    const nextFnStart = source.indexOf("\nexport async function", start + 1);
    const body = source.slice(start, nextFnStart === -1 ? undefined : nextFnStart);
    const uploadIndex = body.indexOf('.upload(storagePath,');
    const updateIndex = body.indexOf(".update({\n      image_storage_path: storagePath,");
    const removePreviousIndex = body.indexOf("existing?.image_storage_path");
    expect(uploadIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeLessThan(updateIndex);
    expect(updateIndex).toBeLessThan(removePreviousIndex);
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

  it("does not carry over image_url, image_storage_path, starts_at, ends_at or published_at as insert keys into the copy", () => {
    const start = source.indexOf("export async function duplicateTipAsDraftAction");
    const insertStart = source.indexOf(".insert({", start);
    const insertEnd = source.indexOf("\n  });", insertStart);
    const insertBody = source.slice(insertStart, insertEnd);
    // Line-anchored (`key:` at the start of a line, ignoring indentation) so
    // this only checks actual object keys, not prose mentioning the same
    // field names inside an explanatory comment within the same block.
    expect(insertBody).not.toMatch(/^\s*image_url\s*:/m);
    expect(insertBody).not.toMatch(/^\s*image_storage_path\s*:/m);
    expect(insertBody).not.toMatch(/^\s*starts_at\s*:/m);
    expect(insertBody).not.toMatch(/^\s*ends_at\s*:/m);
    expect(insertBody).not.toMatch(/^\s*published_at\s*:/m);
  });
});

describe("admin-tips.actions - audit trail (created_by/updated_by)", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("stamps updated_by on every field/status/image mutation", () => {
    const mutatingFunctions = [
      "updateTipAction",
      "uploadTipImageAction",
      "removeTipImageAction",
      "transitionTipStatus",
      "publishTipAction",
    ];

    for (const name of mutatingFunctions) {
      const start = source.indexOf(`function ${name}`);
      const nextFnStart = source.indexOf("\nexport async function", start + 1);
      const nextAsyncFnStart = source.indexOf("\nasync function", start + 1);
      const candidates = [nextFnStart, nextAsyncFnStart].filter((index) => index !== -1);
      const end = candidates.length > 0 ? Math.min(...candidates) : undefined;
      const body = source.slice(start, end);
      expect(body, `${name} should stamp updated_by`).toContain("updated_by: admin.id");
    }
  });
});

describe("admin-tips.actions - cache revalidation", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");

  it("revalidates the admin list, editor, preview and the public gallery after every mutation", () => {
    const helperStart = source.indexOf("function revalidateTipPaths");
    const helperBody = source.slice(helperStart, helperStart + 400);
    expect(helperBody).toContain('revalidatePath("/admin/dicas")');
    expect(helperBody).toContain("revalidatePath(tipEditorPath(tipId))");
    expect(helperBody).toContain('revalidatePath("/app/dicas")');
    expect(helperBody).toContain('revalidatePath("/app/dicas/[slug]", "page")');
  });

  it("never uses force-dynamic just to avoid revalidation", () => {
    expect(source).not.toContain("force-dynamic");
  });
});
