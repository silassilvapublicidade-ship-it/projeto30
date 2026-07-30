import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("Hoje - pre-start_date gating (member-area.service.ts)", () => {
  const source = readSource("src", "server", "services", "member-area.service.ts");

  it("compares today against challenge.start_date, not just personal_start_date", () => {
    expect(source).toContain("challenge?.start_date && today < challenge.start_date");
  });

  it("routes the not-yet-officially-started case to cycle_not_started before ever calling ensureTodayLog", () => {
    const notYetIndex = source.indexOf("notYetOfficiallyStarted");
    const ensureLogIndex = source.indexOf("} else if (ensureLog) {");
    expect(notYetIndex).toBeGreaterThan(-1);
    expect(ensureLogIndex).toBeGreaterThan(-1);
    expect(notYetIndex).toBeLessThan(ensureLogIndex);
  });
});

describe("Hoje - compact card for a challenge that hasn't started (today-experience.tsx)", () => {
  const source = readSource("src", "components", "member", "today-experience.tsx");

  it("renders a dedicated NotStartedCard instead of the full checklist/diary/finalize UI", () => {
    expect(source).toContain('if (enrollmentContext.journeyState === "cycle_not_started")');
    expect(source).toContain("return <NotStartedCard enrollmentContext={enrollmentContext} />;");
  });

  it("the not-started card never renders MissionsSection, ReflectionSection or FinalizeSection", () => {
    const notStartedCardStart = source.indexOf("function NotStartedCard(");
    const notStartedCardEnd = source.indexOf("\nfunction EnrollmentSection(");
    const notStartedCardBody = source.slice(notStartedCardStart, notStartedCardEnd);

    expect(notStartedCardStart).toBeGreaterThan(-1);
    expect(notStartedCardEnd).toBeGreaterThan(notStartedCardStart);
    expect(notStartedCardBody).not.toContain("MissionsSection");
    expect(notStartedCardBody).not.toContain("ReflectionSection");
    expect(notStartedCardBody).not.toContain("FinalizeSection");
  });
});
