import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/perfil/editar - dedicated loading skeleton (Refinamento premium, Parte B item 5)", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "perfil", "editar", "loading.tsx");

  it("exists as its own file, never re-exporting or importing the generic workspace skeleton", () => {
    expect(source).not.toContain("WorkspaceLoading");
    expect(source).not.toMatch(/from ["'].*\(workspace\)\/loading["']/);
  });

  it("mirrors the real page's 4 section cards (foto, dados, seguranca, PWA)", () => {
    expect(source).toContain("Array.from({ length: 4 })");
  });
});
