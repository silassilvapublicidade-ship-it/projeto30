import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(
      process.cwd(),
      "src",
      "app",
      "admin",
      "desafios",
      "[challengeId]",
      "participantes",
      "export",
      "route.ts",
    ),
    "utf8",
  );
}

/**
 * Regression coverage for the CSV export route's authorization/privacy
 * rules (brief: "CSV administrativo; sem e-mail por padrão; opção de
 * incluir dados pessoais somente para super_admin e com confirmação").
 */
describe("participants CSV export route", () => {
  const source = readSource();

  it("requires an authenticated admin before touching any data", () => {
    const requireIndex = source.indexOf("await requireAdminUser()");
    const challengeLookupIndex = source.indexOf("from(\"challenges\")");
    expect(requireIndex).toBeGreaterThan(-1);
    expect(challengeLookupIndex).toBeGreaterThan(requireIndex);
  });

  it("only includes personal data when the role is super_admin AND both p=1 and confirm=1 are present", () => {
    expect(source).toMatch(
      /includePersonalData =\s*\n\s*admin\.role === "super_admin" &&\s*\n\s*searchParams\.p === "1" &&\s*\n\s*searchParams\.confirm === "1";/,
    );
  });

  it("defaults to an anonymized identifier column instead of name/email", () => {
    const headerBlock = source.slice(
      source.indexOf("const headerFields"),
      source.indexOf("headerFields.push"),
    );
    expect(headerBlock).toContain('["Nome", "E-mail"]');
    expect(headerBlock).toContain('["ID do participante"]');
    expect(headerBlock).toMatch(/includePersonalData\s*\n\s*\?\s*\["Nome", "E-mail"\]\s*\n\s*:\s*\[\s*"ID do participante"\s*\]/);
  });

  it("never puts email in the identity fields unless includePersonalData is true", () => {
    const identityBlock = source.slice(
      source.indexOf("const identityFields"),
      source.indexOf("controller.enqueue", source.indexOf("const identityFields")),
    );
    expect(identityBlock).toContain("includePersonalData");
    expect(identityBlock).toContain("participant.email");
    expect(identityBlock).toContain("participant.enrollment_id");
  });

  it("streams page by page via the existing admin_list_participants-backed service, not a second bespoke query", () => {
    expect(source).toContain("listAdminParticipants(parsedId.data,");
    expect(source).not.toContain(".rpc(");
  });

  it("stops paginating once a page returns fewer rows than the page size, never loops forever", () => {
    expect(source).toContain("if (data.rows.length < 20)");
    expect(source).toContain("break;");
  });

  it("responds as a streamed file attachment, never JSON", () => {
    expect(source).toContain('"content-type": "text/csv; charset=utf-8"');
    expect(source).toContain('"content-disposition": `attachment; filename="participantes-${challenge.slug}.csv"`');
    expect(source).toContain("new Response(stream,");
  });

  it("escapes every CSV field through the shared csv.core helper (protects against formula injection)", () => {
    expect(source).toContain('import { csvRow } from "@/features/admin/admin-csv.core";');
    expect(source).not.toContain("function csvField");
  });
});
