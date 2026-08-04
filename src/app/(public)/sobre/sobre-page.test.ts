import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "app", "(public)", "sobre", "page.tsx"), "utf8");
}

describe("/sobre (reescrita institucional)", () => {
  const source = readSource();

  it("grounds the story in the real transformation (30kg, training, reading, faith)", () => {
    expect(source).toMatch(/30 quilos/);
    expect(source).toMatch(/treino/i);
    expect(source).toMatch(/leitura/i);
    expect(source).toMatch(/fé/i);
  });

  it("presents Silas as idealizador/participante, never as coach, guru or religious leader", () => {
    expect(source).toMatch(/idealizador/i);
    expect(source).toContain("Não sou coach, não sou guru, não sou");
    expect(source).toContain("líder religioso");
  });

  it("keeps the exact institutional sentence about not having all the answers", () => {
    expect(source).toContain(
      "Não criei o Projeto 30 porque tenho todas as respostas. Criei porque sei como",
    );
  });

  it("never promises a complete transformation or a guaranteed spiritual/physical result", () => {
    expect(source).not.toMatch(/transforma(ç|c)[aã]o completa|resultado garantido|cura garantida/i);
  });

  it("reinforces constancy over perfection", () => {
    expect(source).toContain("Não é sobre fazer tudo perfeitamente. É sobre não abandonar a");
    expect(source).toContain("caminhada.");
  });
});
