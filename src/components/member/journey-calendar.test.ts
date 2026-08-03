import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "member", "journey-calendar.tsx"), "utf8");
}

/**
 * Real production bug this locks in: Silas's Dia 2 was finalized at 50%
 * completion but the calendar never said the word "finalizado" anywhere -
 * a finalized-but-partial day and a never-opened day shared the same
 * "missed"/"partial" vocabulary. Every finalized state's label must contain
 * "finalizado" so a glance at the calendar (without opening the day detail
 * panel) can never read a real, saved day as not done.
 */
describe("journey-calendar.tsx - state labels never confuse finalized-partial with not-finalized", () => {
  const source = readSource();

  it("every finalized state's aria-label wording contains 'finalizado'", () => {
    const stateLabelStart = source.indexOf("const stateLabel: Record<JourneyDayState, string> = {");
    const stateLabelEnd = source.indexOf("};", stateLabelStart);
    const block = source.slice(stateLabelStart, stateLabelEnd);

    expect(block).toMatch(/completed:\s*"finalizado/);
    expect(block).toMatch(/partial_kept:\s*"finalizado/);
    expect(block).toMatch(/partial_lost:\s*"finalizado/);
  });

  it("not_finalized is explicitly negated ('não finalizado'), never bare 'finalizado' nor the old 'não realizado' wording", () => {
    const stateLabelStart = source.indexOf("const stateLabel: Record<JourneyDayState, string> = {");
    const stateLabelEnd = source.indexOf("};", stateLabelStart);
    const block = source.slice(stateLabelStart, stateLabelEnd);
    const notFinalizedLine = block.split("\n").find((line) => line.trim().startsWith("not_finalized:"));

    expect(notFinalizedLine).toBeDefined();
    expect(notFinalizedLine).toMatch(/"não finalizado"/);
    expect(notFinalizedLine).not.toMatch(/realizado/);
  });

  it("partial_kept and partial_lost share the same visual style (both are finalizado) - the distinction is in wording, not a 6th color", () => {
    const styleStart = source.indexOf("const stateStyle: Record<JourneyDayState, string> = {");
    const styleEnd = source.indexOf("};", styleStart);
    const block = source.slice(styleStart, styleEnd);
    const keptLine = block.split("\n").find((line) => line.trim().startsWith("partial_kept:"));
    const lostLine = block.split("\n").find((line) => line.trim().startsWith("partial_lost:"));

    expect(keptLine).toBeDefined();
    expect(lostLine).toBeDefined();
    expect(keptLine?.split(":")[1]).toBe(lostLine?.split(":")[1]);
  });

  it("the legend spells out 'Finalizado' for both the completed and partial entries, and 'Não finalizado' (never 'não realizado') for the not-finalized one", () => {
    expect(source).toContain("Finalizado, completo");
    expect(source).toContain("Finalizado, parcial");
    expect(source).toContain("Não finalizado");
    expect(source).not.toContain("Não realizado");
  });

  it("DayIcon handles both partial_kept and partial_lost with the same Minus icon, and not_finalized with X", () => {
    const iconStart = source.indexOf("function DayIcon");
    const iconEnd = source.indexOf("export function JourneyCalendar");
    const block = source.slice(iconStart, iconEnd);

    expect(block).toContain('state === "partial_kept" || state === "partial_lost"');
    expect(block).toContain('state === "not_finalized"');
  });
});
