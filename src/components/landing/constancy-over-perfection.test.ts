import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "components", "landing", "constancy-over-perfection.tsx"),
    "utf8",
  );
}

describe("ConstancyOverPerfection", () => {
  const source = readSource();

  it("uses the exact institutional anchor phrases, never a paraphrase", () => {
    expect(source).toContain("Um dia difícil não apaga sua evolução.");
    expect(source).toContain("Voltar também é uma forma de vencer.");
    expect(source).toContain("A meta não é perfeição. É constância.");
  });

  it("never shames or guilt-trips - no punitive language", () => {
    expect(source).not.toMatch(/culpa|falha grave|desistiu|fracass/i);
  });

  it("is wired into the home page between EvolutionDays and ReflectionAchievements", () => {
    const home = readFileSync(join(process.cwd(), "src", "app", "(public)", "page.tsx"), "utf8");
    const evolutionIndex = home.indexOf("<EvolutionDays");
    const constancyIndex = home.indexOf("<ConstancyOverPerfection");
    const reflectionIndex = home.indexOf("<ReflectionAchievements");
    expect(evolutionIndex).toBeGreaterThan(-1);
    expect(constancyIndex).toBeGreaterThan(evolutionIndex);
    expect(reflectionIndex).toBeGreaterThan(constancyIndex);
  });
});
