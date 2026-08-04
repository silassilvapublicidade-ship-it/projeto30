import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/jornada - compartilhamento premium (Refinamento premium, Parte E item 22)", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "jornada", "page.tsx");

  it("gates every share button on real data already loaded on this page - never an indiscriminate button on every card", () => {
    expect(source).toContain("const canShareHalfway = summary.currentDay >= halfwayDay;");
    expect(source).toContain("const canShareLast7Days = daysRemaining >= 0 && daysRemaining <= 6;");
    expect(source).toContain("const canShareProgress = summary.completionPercent > 0;");
    expect(source).toContain('const canShareCompleted = summary.status === "completed";');
  });

  it("renders nothing when no milestone is genuinely available - never a placeholder row", () => {
    expect(source).toContain(
      "if (!canShareHalfway && !canShareLast7Days && !canShareProgress && !canShareCompleted) {\n    return null;\n  }",
    );
  });

  it("challenge_completed supersedes the other 3 once the challenge is actually done - never 4 competing buttons at once", () => {
    const rowStart = source.indexOf("function JourneyShareRow");
    const rowBody = source.slice(rowStart, source.indexOf("\nexport default async function JornadaPage"));
    expect(rowBody).toContain("{canShareCompleted ? (");
    expect(rowBody).toContain('<SnapshotShareButton enrollmentId={enrollmentId} kind="challenge_completed"');
  });

  it("uses the same last-7-days definition (durationDays - currentDay) the backend validates against, never the calendar's daysFinalized-based figure", () => {
    expect(source).toContain("const daysRemaining = summary.durationDays - summary.currentDay;");
  });
});
