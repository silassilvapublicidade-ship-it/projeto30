import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "member", "journey-day-detail.tsx"), "utf8");
}

describe("journey-day-detail.tsx - day detail state labels", () => {
  const source = readSource();

  it("every finalized state label says 'Finalizado', distinguishing streak kept vs lost by wording", () => {
    const stateLabelStart = source.indexOf("const stateLabel: Record<JourneyDayDetail[\"state\"], string> = {");
    const stateLabelEnd = source.indexOf("};", stateLabelStart);
    const block = source.slice(stateLabelStart, stateLabelEnd);

    expect(block).toMatch(/completed:\s*"Finalizado/);
    expect(block).toMatch(/partial_kept:\s*"Finalizado.*sequência mantida"/);
    expect(block).toMatch(/partial_lost:\s*"Finalizado.*sequência não mantida"/);
    expect(block).toMatch(/not_finalized:\s*"Não finalizado"/);
  });

  it("the Fechamento field still independently confirms finalized/em aberto - a second, redundant-on-purpose confirmation", () => {
    expect(source).toContain('{day.finalized ? "Finalizado" : "Em aberto"}');
  });
});
