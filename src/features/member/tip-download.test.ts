import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("getDownloadableTip - service backing the download route", () => {
  const source = readSource("src", "server", "services", "tips.service.ts");

  it("exists and requires auth like the rest of the member tips surface", () => {
    const start = source.indexOf("export async function getDownloadableTip");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\n}", start));
    expect(body).toContain('await requireAuthUser("/app/dicas");');
  });

  it("applies the exact same published/content_type/window filters as getTipBySlug - a draft or expired card must not be downloadable", () => {
    const start = source.indexOf("export async function getDownloadableTip");
    const body = source.slice(start, source.indexOf("\n}", start));
    expect(body).toContain('.eq("content_type", TIP_CONTENT_TYPE)');
    expect(body).toContain('.eq("status", "published")');
    expect(body).toContain(".or(startsFilter)");
    expect(body).toContain(".or(endsFilter)");
  });

  it("selects image_storage_path (needed to fetch the actual file), not just the public url", () => {
    expect(source).toContain(
      'const downloadColumns = "id,title,slug,image_url,image_storage_path";',
    );
  });
});

describe("/api/dicas/[id]/download - secure download route", () => {
  const source = readSource("src", "app", "api", "dicas", "[id]", "download", "route.ts");

  it("validates the id as a UUID before ever touching the database", () => {
    expect(source).toContain("tipIdSchema.safeParse(rawId)");
    expect(source).toMatch(/if \(!parsedId\.success\)/);
  });

  it("never accepts a client-supplied storage path - the only input is the validated id", () => {
    expect(source).not.toMatch(/searchParams\.get\(["']path["']\)/);
    expect(source).not.toContain("request.body");
    expect(source).toContain("getDownloadableTip(parsedId.data)");
  });

  it("404s when the tip doesn't exist, isn't published, or has no image - not a 500 or a silent empty file", () => {
    expect(source).toMatch(/if \(!tip \|\| !tip\.image_storage_path\)/);
    expect(source).toContain('status: 404');
  });

  it("fetches bytes via the Storage API using the server-looked-up path, never the client", () => {
    expect(source).toContain('.storage\n    .from("tip-cards")\n    .download(tip.image_storage_path);');
  });

  it("sets Content-Disposition: attachment with a sanitized dica-{slug} filename", () => {
    expect(source).toContain('"content-disposition": `attachment; filename="${filename}"`');
    expect(source).toContain("const filename = `dica-${sanitizeSlugForFilename(tip.slug)}.${extension}`;");
  });

  it("sanitizeSlugForFilename strips anything outside [a-z0-9-]", () => {
    const start = source.indexOf("function sanitizeSlugForFilename");
    const body = source.slice(start, source.indexOf("\n}", start));
    expect(body).toContain("replace(/[^a-z0-9-]/g,");
  });

  it("never imports or references the service_role key", () => {
    expect(source).not.toContain("service_role");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("createSupabaseServerClient");
  });

  it("sets a correct image content-type derived from the stored extension", () => {
    expect(source).toContain("CONTENT_TYPE_BY_EXTENSION");
    expect(source).toContain('webp: "image/webp"');
  });
});

describe("Detail page - exposes a real 'Baixar imagem' download affordance", () => {
  const detailDir = ["src", "app", "(member)", "app", "(workspace)", "dicas", "[slug]"];
  const source = readSource(...detailDir, "page.tsx");

  it("passes a per-tip secure download URL, not the raw storage/public image URL", () => {
    expect(source).toMatch(/downloadUrl=\{`\/api\/dicas\/\$\{tip\.id\}\/download`\}/);
  });
});
