import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("TipRowActions - per-status menu gating", () => {
  const source = readSource("src", "components", "admin", "tip-row-actions.tsx");

  it("always renders Ver preview and Duplicar, regardless of status", () => {
    expect(source).toContain(
      '<DropdownMenuItem href={`/admin/dicas/${tipId}/preview`}>Ver preview</DropdownMenuItem>',
    );
    const duplicateIndex = source.indexOf("duplicateTipAsDraftAction");
    const before = source.slice(Math.max(0, duplicateIndex - 200), duplicateIndex);
    expect(before).not.toMatch(/status === "\w+"\s*\?\s*\($/);
  });

  it("only offers Editar for draft or published, never archived", () => {
    expect(source).toContain('status === "draft" || status === "published" ?');
  });

  it("only offers Publicar for draft", () => {
    expect(source).toContain('{status === "draft" ? (');
  });

  it("only offers Despublicar and Arquivar for published", () => {
    const matches = source.match(/\{status === "published" \? \(/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it("uses a plain window.confirm guard for delete, not a name-typed modal (proportionate to the lower stakes of a tip card)", () => {
    const deleteFormIndex = source.indexOf("action={deleteTipAction}");
    const body = source.slice(deleteFormIndex, deleteFormIndex + 600);
    expect(body).toContain("window.confirm(");
    expect(body).toContain("event.preventDefault()");
  });

  it("shows a visual separator before the destructive Excluir action", () => {
    expect(source).toContain("<DropdownMenuSeparator />");
  });

  it("styles Excluir as danger", () => {
    const deleteFormIndex = source.indexOf("action={deleteTipAction}");
    const body = source.slice(deleteFormIndex, deleteFormIndex + 600);
    expect(body).toContain('tone="danger"');
  });
});
