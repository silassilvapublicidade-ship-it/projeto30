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

  it("keeps exactly five items in the shared main navigation (desktop + mobile bar) - never a sixth without an explicit density audit", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    expect(mainItemsMatch).not.toBeNull();

    const entryMatches = (mainItemsMatch?.[1] ?? "").match(/\{ href:/g) ?? [];
    expect(entryMatches).toHaveLength(5);
  });

  it("Dashboard is first, Hoje stays right next to it as a clearly separate destination", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    const body = mainItemsMatch?.[1] ?? "";
    const dashboardIndex = body.indexOf('href: "/app/dashboard"');
    const hojeIndex = body.indexOf('href: "/app/hoje"');
    expect(dashboardIndex).toBeGreaterThan(-1);
    expect(hojeIndex).toBeGreaterThan(-1);
    expect(dashboardIndex).toBeLessThan(hojeIndex);
  });

  it("keeps Hoje, Desafios, Jornada and Dicas in the main navigation alongside Dashboard", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    const body = mainItemsMatch?.[1] ?? "";
    for (const href of ["/app/dashboard", "/app/hoje", "/app/desafios", "/app/jornada", "/app/dicas"]) {
      expect(body).toContain(href);
    }
  });

  it("moves Conquistas to the secondary items - still reachable, just not one of the 5 main mobile slots", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    const secondaryItemsMatch = source.match(/const secondaryItems = \[([\s\S]*?)\];/);
    expect(mainItemsMatch?.[1] ?? "").not.toContain("/app/conquistas");
    expect(secondaryItemsMatch?.[1] ?? "").toContain("/app/conquistas");
  });

  it("removes Perfil from the main navigation entirely - it's now a redirect, reachable via the avatar block instead", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    expect(mainItemsMatch?.[1] ?? "").not.toContain("/app/perfil");
    expect(source).not.toMatch(/label:\s*"Perfil"/);
  });
});
