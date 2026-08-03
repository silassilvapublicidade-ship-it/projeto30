import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("AchievementUnlockModal", () => {
  const source = readSource("src", "components", "member", "achievement-unlock-modal.tsx");

  it("is a client component", () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("never renders when there are no unlocked achievements", () => {
    const bodyStart = source.indexOf("export function AchievementUnlockModal");
    const body = source.slice(bodyStart);
    expect(body).toContain("if (achievements.length === 0) {\n    return null;\n  }");
  });

  it("fetches the story-format share card for the current achievement as soon as it becomes visible, no user gesture required", () => {
    expect(source).toContain('fetch(`/api/achievements/${userAchievementId}/share-card?format=story`)');
  });

  it("re-fetches the card whenever the current achievement changes (userAchievementId is the effect dependency)", () => {
    const hookBody = source.slice(source.indexOf("function useShareCard"), source.indexOf("function UnlockSlide"));
    expect(hookBody).toContain("}, [userAchievementId]);");
  });

  it("shares via the Web Share API with the actual image file, same pattern as AchievementArtShareButton", () => {
    expect(source).toContain("navigator.canShare?.({ files: [file] })");
    expect(source).toContain("navigator.share({ files: [file], title: achievement.name })");
  });

  it("disables the share button until the card image has actually loaded", () => {
    expect(source).toContain("disabled={!result}");
  });

  it("offers a download fallback for when the Web Share API isn't available", () => {
    expect(source).toContain('download="projeto30-conquista.png"');
  });

  it("shows a 1-of-N counter only when there's more than one new achievement", () => {
    expect(source).toContain("achievements.length > 1 ? (");
    expect(source).toContain("{index + 1} de {achievements.length}");
  });

  it("advancing past the last achievement closes the modal instead of going out of bounds", () => {
    const advanceHandler = source.slice(source.indexOf("onAdvance={() => {"), source.indexOf("}}\n      />"));
    expect(advanceHandler).toContain("if (isLast) {\n            onOpenChange(false);\n            return;\n          }");
  });

  it("the last slide's button says Fechar, not Próxima conquista - never suggests a nonexistent next achievement", () => {
    expect(source).toContain('{isLast ? "Fechar" : "Próxima conquista"}');
  });

  it("resets to the first achievement for every new finalize result via a remount key, not a setState-in-effect", () => {
    expect(source).toContain(
      'key={achievements.map((achievement) => achievement.userAchievementId).join(",")}',
    );
    // The pager's own index state has no reset effect - remounting via the
    // key above is what restarts it at slide 0.
    const pagerBody = source.slice(source.indexOf("function UnlockPager"), source.indexOf("export function AchievementUnlockModal"));
    expect(pagerBody).not.toContain("useEffect");
  });

  it("every unlock-sequence animation is capped at the 700ms product spec - none run longer or loop", () => {
    expect(source).toContain("p30-unlock-card-in_700ms");
    expect(source).toContain("p30-unlock-glow_700ms");
    expect(source).toContain("p30-unlock-backdrop_700ms");
    expect(source).toContain("p30-sheen_700ms_var(--ease-premium)_200ms_1");
    expect(source).not.toContain("infinite");
  });

  it("particles are a short, discreet burst (6 of them, one-shot, staggered) - never a full confetti effect", () => {
    expect(source).toContain("const PARTICLE_OFFSETS: Array<[number, number]> = [");
    const offsetsBlock = source.slice(
      source.indexOf("const PARTICLE_OFFSETS"),
      source.indexOf("];", source.indexOf("const PARTICLE_OFFSETS")),
    );
    const offsetCount = (offsetsBlock.match(/\[-?\d+, -?\d+\]/g) ?? []).length;
    expect(offsetCount).toBe(6);
    expect(source).toContain("p30-unlock-particle_650ms_var(--ease-premium)_forwards");
  });
});

describe("TodayInteractiveSection - achievement unlock modal wiring", () => {
  const source = readSource("src", "components", "member", "today-interactive-section.tsx");

  it("imports and renders AchievementUnlockModal", () => {
    expect(source).toContain(
      'import { AchievementUnlockModal } from "@/components/member/achievement-unlock-modal";',
    );
    expect(source).toContain("<AchievementUnlockModal");
  });

  it("opens the modal automatically the moment a finalize response includes 1+ unlocked achievements - no manual step required", () => {
    const runFinalizeBody = source.slice(
      source.indexOf("async function runFinalize"),
      source.indexOf("function handleFinalizeSubmit"),
    );
    expect(runFinalizeBody).toContain("if (result.summary.unlockedAchievements.length > 0) {");
    expect(runFinalizeBody).toContain("setUnlockModalOpen(true);");
  });

  it("passes the exact achievements from this finalize's summary, not a stale or guessed list", () => {
    expect(source).toContain("achievements={summary?.unlockedAchievements ?? []}");
  });
});
