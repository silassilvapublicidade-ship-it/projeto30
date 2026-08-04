import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "app", "(public)", "como-funciona", "page.tsx"), "utf8");
}

describe("/como-funciona (correção factual)", () => {
  const source = readSource();

  it("never claims the user freely chooses/defines their own habits", () => {
    expect(source).not.toMatch(/defina (seus |os )?h[aá]bitos poss[ií]veis/i);
    expect(source).not.toMatch(/escolher pr[aá]ticas que realmente caibam/i);
  });

  it("explains habits come pre-defined per cycle", () => {
    expect(source).toMatch(/hábitos.*(definidos|já vem)/i);
  });

  it("never describes the member area as future", () => {
    expect(source).not.toMatch(/área de membros futura/i);
  });
});
