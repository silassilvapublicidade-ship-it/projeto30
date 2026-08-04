import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CURRENT_MONTHLY_CYCLE, NEXT_MONTHLY_CYCLE } from "@/config/monthly-cycles";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("Monthly cycles config (typed, central - no hardcoded copy scattered in JSX)", () => {
  it("describes the current live cycle without inventing data", () => {
    expect(CURRENT_MONTHLY_CYCLE.status).toBe("current");
    expect(CURRENT_MONTHLY_CYCLE.month).toBe("Agosto");
  });

  it("never announces Efatá publicly - the next cycle is always a placeholder until a real draft exists in the admin", () => {
    expect(NEXT_MONTHLY_CYCLE.status).toBe("upcoming");
    expect(JSON.stringify(NEXT_MONTHLY_CYCLE).toLowerCase()).not.toContain("efat");
  });
});

describe("MonthlyCycles section", () => {
  const source = readSource("src", "components", "landing", "monthly-cycles.tsx");

  it("communicates Projeto 30 as the permanent brand across changing monthly cycles", () => {
    expect(source).toContain("Uma nova jornada a cada mês.");
    expect(source).toContain("Projeto 30 é a marca que permanece.");
  });

  it("never hardcodes Efatá in the component itself", () => {
    expect(source.toLowerCase()).not.toContain("efat");
  });

  it("reads cycle data from the typed config, not inline literals", () => {
    expect(source).toContain('from "@/config/monthly-cycles"');
  });
});
