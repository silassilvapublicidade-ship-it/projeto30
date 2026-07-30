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

  it("only renders the delete button for challenges with zero participants", () => {
    expect(source).toContain("challenge.participant_count === 0 ?");
  });

  it("uses the stronger DeleteChallengeButton (not the plain ConfirmSubmitButton) for deletion", () => {
    const deleteFormIndex = source.indexOf("action={deleteChallengeAction}");
    expect(deleteFormIndex).toBeGreaterThan(-1);
    const formBlock = source.slice(deleteFormIndex, deleteFormIndex + 400);
    expect(formBlock).toContain("<DeleteChallengeButton");
  });

  it("surfaces a 'cannot delete' explanation distinct from a generic error", () => {
    expect(source).toContain('"delete-blocked"');
    expect(source).toContain("Arquive-o em vez de excluir.");
  });
});

describe("admin challenge deletion - confirmation UX", () => {
  const source = readSource("src", "components", "admin", "delete-challenge-button.tsx");

  it("requires two distinct confirmations before submitting", () => {
    expect(source).toContain("window.confirm(");
    expect(source).toContain("window.prompt(");
  });

  it("cancels the submit when the typed name does not match", () => {
    expect(source).toMatch(/typed !== challengeName/);
    expect(source).toContain("event.preventDefault();");
  });
});
