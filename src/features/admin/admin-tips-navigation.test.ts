import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

function fileExists(...pathSegments: string[]) {
  try {
    readSource(...pathSegments);
    return true;
  } catch {
    return false;
  }
}

describe("Dicas navigation - visible in the Admin menu, not a hidden URL", () => {
  const source = readSource("src", "components", "admin", "admin-navigation.tsx");

  it("lists Dicas in the shared navItems array, used by both desktop and mobile nav", () => {
    const navItemsStart = source.indexOf("const navItems = [");
    const navItemsEnd = source.indexOf("];", navItemsStart);
    const navItemsBlock = source.slice(navItemsStart, navItemsEnd);
    expect(navItemsBlock).toContain('href: "/admin/dicas"');
    expect(navItemsBlock).toContain('label: "Dicas"');
  });

  it("AdminDesktopNavigation and AdminMobileNavigation both render every item in navItems, so Dicas appears in both", () => {
    expect(source).toContain("export function AdminDesktopNavigation()");
    expect(source).toContain("export function AdminMobileNavigation()");
    const desktopStart = source.indexOf("export function AdminDesktopNavigation()");
    const mobileStart = source.indexOf("export function AdminMobileNavigation()");
    const desktopBody = source.slice(desktopStart, mobileStart);
    const mobileBody = source.slice(mobileStart);
    expect(desktopBody).toContain("navItems.map((item)");
    expect(mobileBody).toContain("navItems.map((item)");
  });

  it("marks the active nav item via isActivePath, matching /admin/dicas and any nested route under it", () => {
    expect(source).toContain("function isActivePath(pathname: string, href: string)");
    expect(source).toContain("pathname === href || pathname.startsWith(`${href}/`)");
  });
});

describe("Dicas routes exist as real pages, not placeholders", () => {
  it("every route required by the round is a real page.tsx file", () => {
    const requiredRoutes = [
      ["src", "app", "admin", "dicas", "page.tsx"],
      ["src", "app", "admin", "dicas", "nova", "page.tsx"],
      ["src", "app", "admin", "dicas", "[id]", "editar", "page.tsx"],
      ["src", "app", "admin", "dicas", "[id]", "preview", "page.tsx"],
    ];

    for (const route of requiredRoutes) {
      expect(fileExists(...route), `${route.join("/")} should exist`).toBe(true);
    }
  });

  it("the admin listing's primary action links to /admin/dicas/nova with the exact requested label", () => {
    const source = readSource("src", "app", "admin", "dicas", "page.tsx");
    expect(source).toContain('href="/admin/dicas/nova"');
    expect(source).toContain("Novo card de dica");
  });

  it("the creation page renders a real form component, not a stub", () => {
    const source = readSource("src", "app", "admin", "dicas", "nova", "page.tsx");
    expect(source).toContain("<TipCreateForm");
    expect(source).toContain('import { TipCreateForm } from "@/components/admin/tip-create-form";');
  });
});
