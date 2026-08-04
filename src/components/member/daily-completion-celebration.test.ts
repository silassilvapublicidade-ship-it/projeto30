import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("DailyCompletionCelebration", () => {
  const source = readSource("src", "components", "member", "daily-completion-celebration.tsx");

  it("is a client component using the native <dialog> pattern (real focus trap/ESC), same as the other modals", () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
    expect(source).toContain("dialog.showModal();");
  });

  it("records daily_completion_summary_viewed exactly when the dialog actually opens, not on every render", () => {
    const effectStart = source.indexOf("useEffect(() => {\n    const dialog = dialogRef.current;\n    if (!dialog) return;\n\n    if (open && !dialog.open) {");
    expect(effectStart).toBeGreaterThan(-1);
    const effectBody = source.slice(effectStart, source.indexOf("}, [open, enrollmentId]);"));
    expect(effectBody).toContain('recordDailyCompletionEventAction("daily_completion_summary_viewed"');
  });

  it("never hides an unlocked achievement - shows a highlighted section whenever hasAchievements is true", () => {
    expect(source).toContain("const hasAchievements = summary.unlockedAchievements.length > 0;");
    expect(source).toContain("{hasAchievements ? (");
  });

  it("hands off to the existing AchievementUnlockModal via onOpenAchievements rather than re-implementing the unlock animation/share flow", () => {
    expect(source).not.toContain("navigator.share(");
    expect(source).not.toContain("share-card");
    expect(source).toContain("onClick={handleViewAchievements}");
    const handlerBody = source.slice(
      source.indexOf("function handleViewAchievements"),
      source.indexOf("function handleViewAchievements") + 300,
    );
    expect(handlerBody).toContain("onOpenAchievements();");
  });

  it("records the continue/journey click events on their respective handlers", () => {
    expect(source).toContain('recordDailyCompletionEventAction("daily_completion_continue_clicked"');
    expect(source).toContain('recordDailyCompletionEventAction("daily_completion_journey_clicked"');
  });

  it("prioritizes points/habits realized before the não-realizados section, and não-realizados stays inside a collapsed <details>, never in bold/red", () => {
    const pointsIndex = source.indexOf("pontos conquistados");
    const notRealizedIndex = source.indexOf("não realizado");
    expect(pointsIndex).toBeGreaterThan(-1);
    expect(notRealizedIndex).toBeGreaterThan(pointsIndex);
    const notRealizedBlock = source.slice(source.indexOf("{notRealized.length > 0 ? ("), source.indexOf("{notApplicable.length > 0 ? ("));
    expect(notRealizedBlock).toContain("<details");
    expect(notRealizedBlock).not.toContain("text-danger");
  });

  it("shows the streak explanation via the shared describeStreakOutcome helper, never a re-implemented copy", () => {
    expect(source).toContain(
      'import { describeStreakBest, describeStreakOutcome } from "@/features/journey/streak-explanation.core";',
    );
    expect(source).toContain("describeStreakOutcome({");
  });

  it("also surfaces streak_best (melhor sequência) right alongside the streak outcome, using the same shared helper", () => {
    expect(source).toContain("const streakBestMessage = describeStreakBest({");
    expect(source).toContain("streakBestMessage");
  });

  it("displays the resolved per-day challenge message (already-resolved-with-fallback, passed in as a prop)", () => {
    expect(source).toContain("challengeMessage");
    expect(source).not.toContain("Você foi um pouco melhor hoje");
  });
});
