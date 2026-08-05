import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "admin", "admin-navigation.tsx"), "utf8");
}

describe("Feedback added to the Admin nav (Rodada 5, Parte C.20)", () => {
  const source = readSource();
  const navItemsStart = source.indexOf("const navItems = [");
  const navItemsEnd = source.indexOf("];", navItemsStart);
  const navItemsBlock = source.slice(navItemsStart, navItemsEnd);

  it("is listed in the shared navItems array", () => {
    expect(navItemsBlock).toContain('href: "/admin/feedback"');
    expect(navItemsBlock).toContain('label: "Feedback"');
  });

  it("desktop keeps all 10 items flat - no space constraint in the sidebar", () => {
    const desktopBody = source.slice(
      source.indexOf("export function AdminDesktopNavigation"),
      source.indexOf("function AdminMobileMoreTab"),
    );
    expect(desktopBody).toContain("navItems.map((item)");
  });

  it("on mobile, less-frequent destinations (Conquistas, Configurações) are tucked under 'Mais' instead of adding a 10th flat tab", () => {
    expect(navItemsBlock).toMatch(/href: "\/admin\/conquistas"[^\n]*overflow: true/);
    expect(navItemsBlock).toMatch(/href: "\/admin\/configuracoes"[^\n]*overflow: true/);
    expect(navItemsBlock).not.toMatch(/href: "\/admin\/feedback"[^\n]*overflow: true/);
  });

  it("mobilePrimaryItems and mobileOverflowItems partition navItems by the overflow flag", () => {
    expect(source).toContain('const mobilePrimaryItems = navItems.filter((item) => !item.overflow);');
    expect(source).toContain("const mobileOverflowItems = navItems.filter((item) => item.overflow);");
  });

  it("the 'Mais' tab renders the overflow items as real links, closing itself on selection", () => {
    const tabBody = source.slice(source.indexOf("function AdminMobileMoreTab"), source.indexOf("export function AdminMobileNavigation"));
    expect(tabBody).toContain("mobileOverflowItems.map((item)");
    expect(tabBody).toContain("onClick={() => setOpen(false)}");
  });
});
