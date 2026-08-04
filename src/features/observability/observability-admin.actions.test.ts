import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("resolveSystemErrorEventAction", () => {
  const source = readSource("src", "features", "observability", "observability-admin.actions.ts");

  it("is a server action", () => {
    expect(source.trimStart().startsWith('"use server";')).toBe(true);
  });

  it("requires an admin session before touching anything", () => {
    const start = source.indexOf("export async function resolveSystemErrorEventAction");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body.indexOf("await requireAdminUser();")).toBeLessThan(body.indexOf("resolveSystemErrorEvent("));
  });

  it("validates status against the exact SYSTEM_ERROR_STATUSES enum, never a free-form string", () => {
    expect(source).toContain("status: z.enum(SYSTEM_ERROR_STATUSES)");
  });

  it("caps the resolution note and version fields, matching the database constraints", () => {
    expect(source).toContain("resolutionNote: z.string().trim().max(500).optional()");
    expect(source).toContain("resolvedInVersion: z.string().trim().max(60).optional()");
  });

  it("does not trust client-side super_admin enforcement alone - relies on the RPC's own gate too (documented)", () => {
    expect(source).toContain("reforçado de novo dentro da RPC");
  });

  it("revalidates both the list and the detail page after a successful update", () => {
    expect(source).toContain('revalidatePath("/admin/observabilidade");');
    expect(source).toContain("revalidatePath(redirectPath);");
  });
});
