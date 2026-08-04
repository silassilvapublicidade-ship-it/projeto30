import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("PublicHeader (the one actually imported by (public)/layout.tsx)", () => {
  const source = readSource("src", "components", "public", "public-header.tsx");

  it("promotes Sobre into the primary desktop nav, in the suggested order", () => {
    const projetoIndex = source.indexOf('"O Projeto"');
    const comoFuncionaIndex = source.indexOf('"Como funciona"');
    const sobreIndex = source.indexOf('"Sobre"');
    expect(projetoIndex).toBeGreaterThan(-1);
    expect(comoFuncionaIndex).toBeGreaterThan(projetoIndex);
    expect(sobreIndex).toBeGreaterThan(comoFuncionaIndex);
  });

  it("links to real routes, not home-only anchors that break on secondary pages", () => {
    expect(source).toContain('href: "/sobre"');
    expect(source).toContain('href: "/como-funciona"');
  });

  it("keeps the header simple - does not add every secondary page", () => {
    expect(source).not.toContain('href: "/faq"');
    expect(source).not.toContain('href: "/manifesto"');
  });

  it("uses the institutional CTA copy", () => {
    expect(source).toContain("Começar gratuitamente");
  });
});

describe("PublicMobileMenu mirrors the desktop nav", () => {
  const source = readSource("src", "components", "public", "public-mobile-menu.tsx");

  it("has the same 3 primary links as the desktop header", () => {
    expect(source).toContain('href: "/#pilares"');
    expect(source).toContain('href: "/como-funciona"');
    expect(source).toContain('href: "/sobre"');
  });

  it("uses the institutional CTA copy", () => {
    expect(source).toContain("Começar gratuitamente");
  });
});
