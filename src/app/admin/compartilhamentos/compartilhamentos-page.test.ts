import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/admin/compartilhamentos (Refinamento premium, Parte E item 24)", () => {
  const source = readSource("src", "app", "admin", "compartilhamentos", "page.tsx");

  it("never offers a free-text field for background/message - only the active toggle", () => {
    expect(source).not.toMatch(/<textarea|<input/i);
    expect(source).toContain("<ShareTemplateToggle");
  });

  it("shows an empty state instead of a broken table when there are zero templates", () => {
    expect(source).toContain("templates.length === 0");
    expect(source).toContain("<EmptyState");
  });
});

describe("admin-share-templates.service.ts", () => {
  const source = readSource("src", "server", "services", "admin-share-templates.service.ts");

  it("never selects a template_version column from share_templates - that column lives on share_cards, not here", () => {
    expect(source).toContain('.select("id, slug, name, active, config, challenge_id, updated_at")');
  });

  it("relies on RLS (admin-only) rather than a service-role client for this read", () => {
    expect(source).toContain("createSupabaseServerClient");
    expect(source).not.toContain("createSupabaseAdminClient");
  });
});

describe("admin-share-templates.actions.ts", () => {
  const source = readSource("src", "features", "admin", "admin-share-templates.actions.ts");

  it("requires an authenticated admin before writing", () => {
    expect(source).toContain("await requireAdminUser();");
  });

  it("only ever writes the active column - never config/name/slug", () => {
    const fnBody = source.slice(source.indexOf("export async function toggleShareTemplateActiveAction"));
    expect(fnBody).toContain(".update({ active: parsed.data.active })");
    expect(fnBody).not.toContain("config:");
  });

  it("validates its input with zod before touching the database", () => {
    expect(source).toContain("toggleSchema.safeParse");
  });
});
