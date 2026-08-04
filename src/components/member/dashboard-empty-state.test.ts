import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("DashboardNewJourneyHero (Correções obrigatórias pré-lançamento, Parte A)", () => {
  const source = readSource("src", "components", "member", "dashboard-empty-state.tsx");

  it("uses the exact title/body copy from the brief", () => {
    expect(source).toContain("Sua jornada começa aqui.");
    expect(source).toContain("Escolha um desafio para começar a construir sua evolução, um dia de cada vez.");
  });

  it("the primary CTA points to the challenge catalog, never a dead link", () => {
    const heroStart = source.indexOf("export function DashboardNewJourneyHero");
    const heroBody = source.slice(heroStart, source.indexOf("export function DashboardExploreChallengesBanner"));
    expect(heroBody).toContain('href="/app/desafios"');
    expect(heroBody).toContain("Explorar desafios");
  });

  it("shows the 3-step explanation without duplicating /app/hoje's own empty state copy", () => {
    expect(source).toContain("Escolha um desafio");
    expect(source).toContain("Registre suas ações");
    expect(source).toContain("Acompanhe sua evolução");
    expect(source).not.toContain("Respire");
    expect(source).not.toContain("Sua área está pronta");
  });

  it("never renders a zeroed metric or count - it's a pure hero, no numbers", () => {
    const heroStart = source.indexOf("export function DashboardNewJourneyHero");
    const heroBody = source.slice(heroStart, source.indexOf("export function DashboardExploreChallengesBanner"));
    expect(heroBody).not.toMatch(/\{.*totals\.|\{.*overview\./);
  });
});

describe("DashboardExploreChallengesBanner", () => {
  const source = readSource("src", "components", "member", "dashboard-empty-state.tsx");

  it("offers the 'Explorar novos desafios' CTA from the brief", () => {
    const bannerStart = source.indexOf("export function DashboardExploreChallengesBanner");
    const bannerBody = source.slice(bannerStart);
    expect(bannerBody).toContain("Explorar novos desafios");
    expect(bannerBody).toContain('href="/app/desafios"');
  });
});
