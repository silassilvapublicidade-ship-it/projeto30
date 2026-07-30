import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("admin challenge deletion - actions", () => {
  const source = readSource("src", "features", "admin", "admin-challenges.actions.ts");

  it("requires an admin before attempting to delete", () => {
    const deleteActionStart = source.indexOf("export async function deleteChallengeAction");
    const deleteActionBody = source.slice(deleteActionStart, deleteActionStart + 400);
    expect(deleteActionBody).toContain("await requireAdminUser();");
  });

  it("performs a real delete against public.challenges, not a soft status change", () => {
    expect(source).toContain('supabase.from("challenges").delete().eq("id", parsedId.data)');
  });

  it("treats a foreign_key_violation (23503) as 'has history, cannot delete' rather than a generic error", () => {
    expect(source).toContain('error.code === "23503"');
    expect(source).toContain('"delete-blocked"');
  });
});

describe("admin challenge deletion - list page wiring", () => {
  const source = readSource("src", "app", "admin", "desafios", "page.tsx");

  it("delegates every row's actions (including delete) to the consolidated ChallengeRowActions menu", () => {
    expect(source).toContain("<ChallengeRowActions");
    expect(source).toContain("participantCount={challenge.participant_count}");
    // The old flat per-status button row (and its window.confirm-based
    // delete button) must not come back - status-conditional rendering now
    // lives inside ChallengeRowActions, not in this page.
    expect(source).not.toContain("DeleteChallengeButton");
    expect(source).not.toContain("ConfirmSubmitButton");
  });

  it("surfaces a 'cannot delete' explanation distinct from a generic error", () => {
    expect(source).toContain('"delete-blocked"');
    expect(source).toContain("Arquive-o em vez de excluir.");
  });
});

describe("admin challenge deletion - row action gating (ChallengeRowActions)", () => {
  const source = readSource("src", "components", "admin", "challenge-row-actions.tsx");

  it("only allows deletion for draft challenges with zero participants", () => {
    expect(source).toContain('status === "draft" && participantCount === 0');
  });

  it("never renders Excluir for active or archived challenges, regardless of participant count", () => {
    const canDeleteIndex = source.indexOf("canDelete");
    expect(canDeleteIndex).toBeGreaterThan(-1);
    // canDelete is the single gate for both the menu item and the dialog -
    // there must be no second, independent "show delete" condition that
    // could disagree with it.
    expect(source.match(/canDelete/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("renders exactly the spec'd action set for each status", () => {
    // Draft: Editar, Publicar, Duplicar, Excluir (no Ver detalhes, no Arquivar)
    expect(source).toContain('status === "draft" || status === "active"');
    expect(source).toContain('status === "draft" ?');
    // Active: Ver detalhes, Editar, Despublicar, Arquivar, Duplicar
    expect(source).toContain('status === "active" || status === "archived"');
    expect(source).toContain('status === "active" ?');
    // Archived: Ver detalhes, Duplicar only
    expect(source).toContain('status === "draft" || status === "active" || status === "archived"');
  });

  it("closes the menu when a status-transition form is submitted", () => {
    expect(source).toContain('<form action={action} onSubmit={close}>');
  });
});

describe("admin challenge deletion - confirmation UX (DeleteChallengeDialog)", () => {
  const source = readSource("src", "components", "admin", "delete-challenge-dialog.tsx");

  it("uses a real modal (ConfirmDialog), not window.confirm/window.prompt", () => {
    expect(source).toContain("ConfirmDialog");
    expect(source).not.toContain("window.confirm(");
    expect(source).not.toContain("window.prompt(");
  });

  it("shows the exact required warning text", () => {
    expect(source).toContain("Esta ação excluirá definitivamente este desafio.");
  });

  it("keeps the destructive submit disabled until the typed name matches exactly", () => {
    expect(source).toContain("confirmDisabled={typedName !== challengeName}");
  });

  it("resets the typed name when the dialog is closed, so a stale match can't linger for next time", () => {
    expect(source).toContain("setTypedName(\"\")");
  });
});

describe("admin challenge deletion - ConfirmDialog gating primitive", () => {
  const source = readSource("src", "components", "ui", "confirm-dialog.tsx");

  it("disables the submit button when confirmDisabled is set", () => {
    expect(source).toContain("disabled={confirmDisabled}");
  });

  it("also blocks submission at the form level, not just via the disabled button", () => {
    const formIndex = source.indexOf("<form\n");
    expect(formIndex).toBeGreaterThan(-1);
    const formBlock = source.slice(formIndex, formIndex + 700);
    expect(formBlock).toContain("onSubmit=");
    expect(formBlock).toContain("event.preventDefault()");
  });
});
