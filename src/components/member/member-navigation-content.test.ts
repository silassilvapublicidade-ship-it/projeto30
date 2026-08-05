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

describe("member navigation content - definitive architecture (scalable nav round)", () => {
  const source = readNavigationSource();

  it("removes Leitura from the navigation entirely", () => {
    expect(source).not.toContain("/app/leitura");
    expect(source).not.toMatch(/label:\s*"Leitura"/);
  });

  it("keeps exactly 4 daily-use items in mainItems - Dicas is no longer one of them, it now lives in /app/mais", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    expect(mainItemsMatch).not.toBeNull();

    const entryMatches = (mainItemsMatch?.[1] ?? "").match(/\{ href:/g) ?? [];
    expect(entryMatches).toHaveLength(4);
    expect(mainItemsMatch?.[1] ?? "").not.toContain("/app/dicas");
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

  it("keeps exactly Dashboard, Hoje, Jornada, Desafios in mainItems, in that exact order - the definitive Bottom Navigation contract", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    const body = mainItemsMatch?.[1] ?? "";
    const order = ["/app/dashboard", "/app/hoje", "/app/jornada", "/app/desafios"];
    let lastIndex = -1;
    for (const href of order) {
      const index = body.indexOf(href);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it("both MemberDesktopNavigation and MemberMobileNavigation append a real 'Mais' link to /app/mais - never a dead-end grouping label", () => {
    expect(source).toContain('href="/app/mais" icon={MoreHorizontal} label="Mais"');
    const desktopBody = source.slice(
      source.indexOf("export function MemberDesktopNavigation"),
      source.indexOf("export function MemberMobileNavigation"),
    );
    const mobileBody = source.slice(source.indexOf("export function MemberMobileNavigation"));
    expect(desktopBody).toContain('href="/app/mais"');
    expect(mobileBody).toContain('href="/app/mais"');
  });

  it("Mais lights up (isMaisActive) for every page that moved out of the main nav - Conquistas, Diário, Dicas, Configurações, Feedback, Perfil, Notificações", () => {
    const prefixesMatch = source.match(/const MAIS_ACTIVE_PREFIXES = \[([\s\S]*?)\];/);
    const body = prefixesMatch?.[1] ?? "";
    for (const prefix of [
      "/app/mais",
      "/app/conquistas",
      "/app/diario",
      "/app/dicas",
      "/app/configuracoes",
      "/app/feedback",
      "/app/perfil",
      "/app/notificacoes",
    ]) {
      expect(body).toContain(prefix);
    }
  });

  it("removes Perfil from the main navigation entirely - it's now reachable only via the avatar -> /app/mais -> Editar perfil path", () => {
    const mainItemsMatch = source.match(/const mainItems = \[([\s\S]*?)\];/);
    expect(mainItemsMatch?.[1] ?? "").not.toContain("/app/perfil");
    expect(source).not.toMatch(/label:\s*"Perfil"/);
  });

  it("no longer defines a secondaryItems array - every secondary destination now lives inside /app/mais itself, not a second inline list here", () => {
    expect(source).not.toContain("const secondaryItems");
  });
});
