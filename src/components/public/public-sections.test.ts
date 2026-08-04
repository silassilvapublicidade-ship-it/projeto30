import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { publicFaqItems } from "./public-sections";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "public", "public-sections.tsx"), "utf8");
}

describe("publicFaqItems (alinhamento institucional)", () => {
  it("no longer describes the product as merely a responsive web app - it's an installable PWA", () => {
    const appQuestion = publicFaqItems.find((item) => item.question === "O Projeto 30 é um aplicativo?");
    expect(appQuestion).toBeDefined();
    expect(appQuestion?.answer).not.toContain("aplicação web responsiva");
    expect(appQuestion?.answer).toMatch(/instalável|tela inicial/);
  });

  it("never promises full offline functionality", () => {
    const appQuestion = publicFaqItems.find((item) => item.question === "O Projeto 30 é um aplicativo?");
    expect(appQuestion?.answer).not.toMatch(/funciona (totalmente )?offline|sem internet/i);
  });

  it("adds the 8 institutional questions about faith, adaptation, privacy and cycles", () => {
    const questions = publicFaqItems.map((item) => item.question);
    expect(questions).toContain("O Projeto 30 pertence a alguma religião?");
    expect(questions).toContain("Preciso frequentar uma igreja?");
    expect(questions).toContain("Preciso ter experiência com leitura bíblica?");
    expect(questions).toContain("Os desafios são iguais todos os meses?");
    expect(questions).toContain("Posso adaptar alguma atividade à minha realidade?");
    expect(questions).toContain("Minha reflexão pessoal fica privada?");
    expect(questions).toContain("Preciso compartilhar minha evolução?");
    expect(questions).toContain("Posso entrar em um ciclo depois que ele começou?");
  });

  it("states the religion answer as non-denominational, never tied to a specific church", () => {
    const item = publicFaqItems.find((entry) => entry.question === "O Projeto 30 pertence a alguma religião?");
    expect(item?.answer).toMatch(/não denominacional/i);
  });

  it("states private reflections never appear in shares or to other participants", () => {
    const item = publicFaqItems.find((entry) => entry.question === "Minha reflexão pessoal fica privada?");
    expect(item?.answer).toMatch(/privad/i);
    expect(item?.answer).toMatch(/não são exibidos|não aparecem/i);
  });

  it("states sharing is always optional, never required", () => {
    const item = publicFaqItems.find((entry) => entry.question === "Preciso compartilhar minha evolução?");
    expect(item?.answer).toMatch(/opcional/i);
  });

  it("has no duplicate questions", () => {
    const questions = publicFaqItems.map((item) => item.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});

describe("PlatformPreview caption (público)", () => {
  const source = readSource();

  it("never describes the member area as future/not-yet-built", () => {
    expect(source).not.toMatch(/futura área de membros/i);
  });
});
