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
    expect(source).toContain('from "@/features/journey/progress-motivation.core";');
    expect(source).toContain("resolveDailyChallengeMessage");
    expect(source).toContain("resolveProgressMotivationalMessage");
  });

  it("the daily celebration only opens on a genuinely fresh finalize and never re-opens on revisit/reload", () => {
    expect(source).toContain("const [celebrationOpen, setCelebrationOpen] = useState(false);");
    expect(source).toContain("if (!result.summary.alreadyFinalized) {\n      setCelebrationOpen(true);\n    }");
    // the inline FinalizeSummaryPanel is now reserved for the revisit case only
    expect(source).toContain("{displaySummary && !displaySummary.justFinalized ? (");
  });

  it("streak line reflects the real outcome (met/not met), reusing describeStreakOutcome - never a bare, unexplained number once the day is finalized", () => {
    expect(source).toContain(
      'import { describeStreakBest, describeStreakOutcome } from "@/features/journey/streak-explanation.core";',
    );
    expect(source).toContain("const liveStreakOutcome = displaySummary");
  });

  it("also surfaces streak_best (melhor sequência) on the live card, never just the current streak", () => {
    expect(source).toContain("const liveStreakBestMessage = describeStreakBest({");
    expect(source).toContain("initialStreakBest");
  });

  it("touch targets for the most-tapped controls (habit status buttons, Finalizar o dia) meet the ~44px minimum, never xs/sm", () => {
    const missionRowStart = source.indexOf("function MissionRow(");
    const missionRowEnd = source.indexOf("type DisplaySummary");
    const missionRowBody = source.slice(missionRowStart, missionRowEnd);
    expect(missionRowBody).not.toContain('size="xs"');
    expect(missionRowBody).not.toContain('size="sm"');

    const finalizeSectionStart = source.indexOf("safe-fixed-above-nav");
    const finalizeSectionEnd = source.indexOf("</section>", finalizeSectionStart);
    const finalizeSection = source.slice(finalizeSectionStart, finalizeSectionEnd);
    expect(finalizeSection).toContain('size="md"');
  });

  it("never re-introduces the redundant 'Confirmar finalização' checkbox - the Finalizar o dia button alone is the confirmation", () => {
    expect(source).not.toContain("Confirmar finalização");
    expect(source).not.toContain("confirmChecked");
    expect(source).not.toContain('import { Checkbox } from "@/components/ui/field";');
  });

  it("the finalize action bar is sticky on mobile, above the bottom nav, and reverts to static in-flow at md:", () => {
    const sectionStart = source.indexOf("safe-fixed-above-nav");
    const sectionEnd = source.indexOf(">", sectionStart);
    const sectionClassName = source.slice(sectionStart, sectionEnd);
    expect(sectionClassName).toContain("sticky");
    expect(sectionClassName).toContain("md:static");
  });

  it("day-over-day comparison uses the shared resolver and never fabricates a comparison when yesterday has no finalized log", () => {
    expect(source).toContain("describeDayOverDayComparison");
    expect(source).toContain("yesterdayCompletionPercent");
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
