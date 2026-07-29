import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// member-navigation.tsx is a client component (not includable by this
// project's .test.ts-only vitest config without a DOM/testing-library
// setup this codebase doesn't have yet), so - matching the same static
// text-regression pattern already used for SQL migrations in this repo -
// this asserts directly on its source text instead of rendering it.
function readNavigationSource() {
  return readFileSync(
    join(process.cwd(), "src", "components", "member", "member-navigation.tsx"),
    "utf8",
  );
}

describe("member navigation content", () => {
  const source = readNavigationSource();

  it("removes Leitura from the navigation entirely", () => {
    expect(source).not.toContain("/app/leitura");
    expect(source).not.toMatch(/label:\s*"Leitura"/);
  });

  it("adds Dicas in the main navigation", () => {
    expect(source).toContain("/app/dicas");
    expect(source).toMatch(/label:\s*"Dicas"/);
  });

  it("keeps exactly six items in the shared main navigation (desktop + mobile bar)", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    expect(mainItemsMatch).not.toBeNull();

    const entryMatches = (mainItemsMatch?.[1] ?? "").match(/\{ href:/g) ?? [];
    expect(entryMatches).toHaveLength(6);
  });

  it("keeps Hoje, Desafios, Jornada, Conquistas and Perfil alongside Dicas", () => {
    for (const href of [
      "/app/hoje",
      "/app/desafios",
      "/app/jornada",
      "/app/dicas",
      "/app/conquistas",
      "/app/perfil",
    ]) {
      expect(source).toContain(href);
    }
  });
});
