import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("TipRowActions - per-status menu gating", () => {
  const source = readSource("src", "components", "admin", "tip-row-actions.tsx");

  it("always renders Ver prévia, Editar and Duplicar, regardless of status (matches every status's action list)", () => {
    expect(source).toContain(
      '<DropdownMenuItem href={`/admin/dicas/${tipId}/preview`}>Ver prévia</DropdownMenuItem>',
    );
    expect(source).toContain(
      '<DropdownMenuItem href={`/admin/dicas/${tipId}/editar`}>Editar</DropdownMenuItem>',
    );

    const duplicateIndex = source.indexOf("duplicateTipAsDraftAction");
    const before = source.slice(Math.max(0, duplicateIndex - 200), duplicateIndex);
    expect(before).not.toMatch(/status === "\w+"\s*\?\s*\($/);
  });

  it("offers Publicar for draft and Publicar novamente for archived, both via publishTipAction", () => {
    expect(source).toContain('{status === "draft" ? (');
    expect(source).toContain('{status === "archived" ? (');
    const draftIndex = source.indexOf('{status === "draft" ? (');
    const draftBlock = source.slice(draftIndex, draftIndex + 250);
    expect(draftBlock).toContain("action={publishTipAction}");
    expect(draftBlock).toContain("Publicar");
    const archivedIndex = source.indexOf('{status === "archived" ? (');
    const archivedBlock = source.slice(archivedIndex, archivedIndex + 250);
    expect(archivedBlock).toContain("action={publishTipAction}");
    expect(archivedBlock).toContain("Publicar novamente");
  });

  it("only offers Despublicar and Arquivar for published", () => {
    const matches = source.match(/\{status === "published" \? \(/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it("uses a real modal (TipDeleteDialog) for delete, not window.confirm", () => {
    expect(source).toContain("TipDeleteDialog");
    expect(source).not.toContain("window.confirm(");
  });

  it("shows a visual separator before the destructive Excluir action", () => {
    expect(source).toContain("<DropdownMenuSeparator />");
  });

  it("styles Excluir as danger", () => {
    const deleteItemIndex = source.indexOf("Excluir");
    const body = source.slice(Math.max(0, deleteItemIndex - 200), deleteItemIndex + 50);
    expect(body).toContain('tone="danger"');
  });

  it("opens the delete dialog via local state, not by submitting a form directly", () => {
    expect(source).toContain("const [deleteOpen, setDeleteOpen] = useState(false);");
    expect(source).toContain("setDeleteOpen(true)");
  });
});
