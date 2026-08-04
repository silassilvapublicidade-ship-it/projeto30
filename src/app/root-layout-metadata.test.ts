import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("Root layout metadata (Parte I - alinhamento institucional)", () => {
  const source = readSource("src", "app", "layout.tsx");

  it("adopts the official promise as the default title", () => {
    expect(source).toContain('default: "Projeto 30, 30 dias para evoluir"');
  });

  it("adopts the four-pillars description consistently across metadata surfaces", () => {
    const descriptionOccurrences = source.match(/fortalecer corpo, mente, caráter e espírito/g) ?? [];
    expect(descriptionOccurrences.length).toBeGreaterThanOrEqual(1);
  });

  it("never promises a medical, religious or guaranteed physical outcome", () => {
    expect(source).not.toMatch(/emagrec|cura\b|resultado garantido/i);
  });
});

describe("Home page metadata", () => {
  const source = readSource("src", "app", "(public)", "page.tsx");

  it("adopts the official promise in the home title", () => {
    expect(source).toContain("30 dias para evoluir");
  });

  it("mentions the four pillars in the home description", () => {
    expect(source).toMatch(/corpo, mente, caráter e espírito/);
  });
});

describe("Web app manifest description", () => {
  const source = readSource("src", "app", "manifest.ts");

  it("adopts the four-pillars description, not a generic placeholder", () => {
    expect(source).toMatch(/corpo, mente, caráter e espírito/);
  });
});
