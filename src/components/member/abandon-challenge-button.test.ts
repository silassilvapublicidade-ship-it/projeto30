import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AbandonChallengeButton / ConfirmDialog", () => {
  const buttonSource = readFileSync(
    join(process.cwd(), "src", "components", "member", "abandon-challenge-button.tsx"),
    "utf8",
  );
  const dialogSource = readFileSync(
    join(process.cwd(), "src", "components", "ui", "confirm-dialog.tsx"),
    "utf8",
  );

  it("uses the exact confirmation copy specified for the abandon flow", () => {
    expect(buttonSource).toContain("Abandonar desafio?");
    expect(buttonSource).toContain(
      "Seu progresso e suas anotações serão preservados, mas você não poderá continuar registrando atividades neste desafio.",
    );
  });

  it("passes the enrollmentId as a hidden field into the confirmation form, never as a global/ambient value", () => {
    expect(buttonSource).toContain("hiddenFields={{ enrollmentId }}");
  });

  it("uses a real native <dialog> (showModal/close), not window.confirm, for this flow", () => {
    expect(dialogSource).toContain("dialogRef.current");
    expect(dialogSource).toContain("showModal()");
    expect(dialogSource).not.toContain("window.confirm");
  });

  it("wires ESC (native cancel event) and backdrop click back to onOpenChange(false)", () => {
    expect(dialogSource).toContain('dialog.addEventListener("cancel"');
    expect(dialogSource).toContain("onOpenChange(false)");
  });

  it("sets aria-labelledby/aria-describedby on the dialog for accessible naming", () => {
    expect(dialogSource).toContain("aria-labelledby={titleId}");
    expect(dialogSource).toContain("aria-describedby={descriptionId}");
  });
});
