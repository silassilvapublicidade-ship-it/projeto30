import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "admin", "admin-navigation.tsx"), "utf8");
}

describe("Observabilidade in the shared admin nav", () => {
  const source = readSource();
  const navItemsStart = source.indexOf("const navItems = [");
  const navItemsEnd = source.indexOf("];", navItemsStart);
  const navItemsBlock = source.slice(navItemsStart, navItemsEnd);

  it("is listed in the shared navItems array, used by both desktop and mobile nav", () => {
    expect(navItemsBlock).toContain('href: "/admin/observabilidade"');
    expect(navItemsBlock).toContain('label: "Observabilidade"');
  });

  it("uses a coherent icon (Activity), per the suggested options", () => {
    expect(navItemsBlock).toContain("icon: Activity");
    expect(source).toContain("Activity,");
  });

  it("defines a shorter mobileLabel so the already-dense mobile bar does not get more cramped", () => {
    expect(navItemsBlock).toContain('mobileLabel: "Diagnóstico"');
  });

  it("NavLink actually uses mobileLabel on mobile and falls back to label everywhere else", () => {
    const navLinkStart = source.indexOf("function NavLink(");
    const mobileBranch = source.slice(navLinkStart, source.indexOf('if (mode === "mobile")', navLinkStart) + 2000);
    expect(mobileBranch).toContain("{mobileLabel ?? label}");
  });

  it("appears in both AdminDesktopNavigation (all items) and AdminMobileNavigation (primary items, not tucked into 'Mais')", () => {
    const desktopBody = source.slice(
      source.indexOf("export function AdminDesktopNavigation"),
      source.indexOf("export function AdminMobileMoreTab"),
    );
    expect(desktopBody).toContain("navItems.map((item)");
    // Observabilidade is not flagged overflow, so it's part of mobilePrimaryItems.
    expect(navItemsBlock).not.toMatch(/href: "\/admin\/observabilidade"[^\n]*overflow: true/);
    const mobileNavBody = source.slice(source.indexOf("export function AdminMobileNavigation"));
    expect(mobileNavBody).toContain("mobilePrimaryItems.map((item)");
  });
});
