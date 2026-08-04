import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "landing", "four-pillars.tsx"), "utf8");
}

describe("FourPillars", () => {
  const source = readSource();

  it("names all four pillars exactly as the institutional document defines them", () => {
    expect(source).toContain('title: "Corpo"');
    expect(source).toContain('title: "Mente"');
    expect(source).toContain('title: "Caráter"');
    expect(source).toContain('title: "Espírito"');
  });

  it("frames the project as integral, not a fitness list", () => {
    expect(source).toContain("Uma jornada para a vida por inteiro.");
  });

  it("keeps the spiritual pillar welcoming and non-denominational (no church/doctrine wording)", () => {
    const espiritoLine = source.slice(source.indexOf('title: "Espírito"'), source.indexOf('title: "Espírito"') + 200);
    expect(espiritoLine).not.toMatch(/igreja|doutrina|denomina/i);
  });

  it("is wired into the home page between the continuity problem and the product demo", () => {
    const home = readFileSync(join(process.cwd(), "src", "app", "(public)", "page.tsx"), "utf8");
    const pillarsIndex = home.indexOf("<FourPillars");
    const continuityIndex = home.indexOf("<ContinuityProblem");
    const productIndex = home.indexOf("<ProductInUse");
    expect(continuityIndex).toBeGreaterThan(-1);
    expect(pillarsIndex).toBeGreaterThan(continuityIndex);
    expect(productIndex).toBeGreaterThan(pillarsIndex);
  });
});
