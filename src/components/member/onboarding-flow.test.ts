import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "member", "onboarding-flow.tsx"), "utf8");
}

describe("Onboarding goal step (alinhamento aos quatro pilares)", () => {
  const source = readSource();

  it("offers the 4 pillars plus 'evolução completa', each with a short explanation", () => {
    expect(source).toContain('label: "Corpo"');
    expect(source).toContain('label: "Mente"');
    expect(source).toContain('label: "Carater"');
    expect(source).toContain('label: "Espirito"');
    expect(source).toContain('label: "Evolucao completa"');
  });

  it("maps every new label to an existing enum value - no schema/migration needed", () => {
    expect(source).toContain('value: "health"');
    expect(source).toContain('value: "mind"');
    expect(source).toContain('value: "discipline"');
    expect(source).toContain('value: "faith"');
    expect(source).toContain('value: "complete"');
  });

  it("no longer offers 'routine' as a visible choice, but the value still round-trips through the same hidden input", () => {
    expect(source).not.toContain('value: "routine"');
    expect(source).toContain('name="primaryGoal"');
  });

  it("renders a description line under each goal option", () => {
    expect(source).toContain("goal.description");
  });
});
