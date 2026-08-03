import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("TodayInteractiveSection - progress card redesign (Parte D)", () => {
  const source = readSource("src", "components", "member", "today-interactive-section.tsx");

  it("never uses the percentage as the dominant headline - the big font-display number is now points, not percent", () => {
    const cardStart = source.indexOf('<p className="font-display text-lg text-foreground">');
    const cardEnd = source.indexOf("{displaySummary && !displaySummary.justFinalized ? (");
    const card = source.slice(cardStart, cardEnd);
    expect(card).toContain("resolveProgressMotivationalMessage(progress.completionPercent)");
    expect(card).toContain("{displaySummary?.pointsEarned ?? 0}");
    // percent still shown, but only as small/secondary text
    expect(card).toContain('font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2');
    expect(card).toContain("dos hábitos diários aplicáveis");
  });

  it("uses the shared motivational-by-percent resolver, never an inline duplicate", () => {
    expect(source).toContain(
      'import { resolveDailyChallengeMessage, resolveProgressMotivationalMessage } from "@/features/journey/progress-motivation.core";',
    );
  });

  it("the daily celebration only opens on a genuinely fresh finalize and never re-opens on revisit/reload", () => {
    expect(source).toContain("const [celebrationOpen, setCelebrationOpen] = useState(false);");
    expect(source).toContain("if (!result.summary.alreadyFinalized) {\n      setCelebrationOpen(true);\n    }");
    // the inline FinalizeSummaryPanel is now reserved for the revisit case only
    expect(source).toContain("{displaySummary && !displaySummary.justFinalized ? (");
  });

  it("streak line reflects the real outcome (met/not met), reusing describeStreakOutcome - never a bare, unexplained number once the day is finalized", () => {
    expect(source).toContain(
      'import { describeStreakOutcome } from "@/features/journey/streak-explanation.core";',
    );
    expect(source).toContain("const liveStreakOutcome = displaySummary");
  });

  it("passes enrollmentId/dayNumber/challengeDayMessage down for the celebration to use", () => {
    const fnStart = source.indexOf("export function TodayInteractiveSection({");
    const bodyStart = source.indexOf("const [baseline]", fnStart);
    const propsBlock = source.slice(fnStart, bodyStart);
    expect(propsBlock).toContain("challengeDayMessage");
    expect(propsBlock).toContain("dayNumber");
    expect(propsBlock).toContain("enrollmentId");
    expect(propsBlock).toContain("streakMinimumCompletion");
  });
});
