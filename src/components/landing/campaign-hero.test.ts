import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "landing", "campaign-hero.tsx"), "utf8");
}

describe("CampaignHero (alinhamento institucional)", () => {
  const source = readSource();

  it("communicates the official promise as the headline", () => {
    expect(source).toContain("30 dias para evoluir.");
  });

  it("communicates the four pillars in the subheadline", () => {
    expect(source).toContain(
      "Uma jornada de pequenas escolhas para fortalecer corpo, mente, caráter e",
    );
    expect(source).toContain("espírito.");
  });

  it("shows the Projeto 30 brand eyebrow above the headline", () => {
    expect(source).toContain("Projeto 30");
  });

  it("uses the institutional primary and secondary CTAs", () => {
    expect(source).toContain("Começar gratuitamente");
    expect(source).toContain("Conhecer o projeto");
  });

  it("never promises weight loss, a cure or a guaranteed result", () => {
    expect(source).not.toMatch(/emagrec|cura\b|resultado garantido/i);
  });
});
