import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "server", "rendering", "achievement-share-card.render.tsx"),
    "utf8",
  );
}

describe("renderAchievementShareCardImage", () => {
  const source = readSource();

  it("removed the emoji trophy placeholder - medals are now real icon components", () => {
    expect(source).not.toContain("🏆");
  });

  it("loads the vendored brand fonts from disk once at module scope, not per request", () => {
    expect(source).toContain('readFontFile("Fraunces-Bold.woff")');
    expect(source).toContain('readFontFile("Manrope-Regular.woff")');
    expect(source).toContain('readFontFile("Manrope-ExtraBold.woff")');
    expect(source).toContain('readFontFile("IBMPlexMono-Medium.woff")');
    const moduleBody = source.slice(0, source.indexOf("export function renderAchievementShareCardImage"));
    expect(moduleBody).toContain("readFontFile(");
  });

  it("passes all 4 loaded fonts to ImageResponse", () => {
    const fontsBlock = source.slice(source.indexOf("fonts: ["), source.indexOf("height: config.height"));
    expect(fontsBlock).toContain("FONT_FILES.displayBold");
    expect(fontsBlock).toContain("FONT_FILES.sansRegular");
    expect(fontsBlock).toContain("FONT_FILES.sansBold");
    expect(fontsBlock).toContain("FONT_FILES.mono");
  });

  it("embeds the real Projeto 30 logo mark as a data URI, not a text-only PROJETO 30 label", () => {
    expect(source).toContain('"public", "brand", "logo-mark-1024.png"');
    expect(source).toContain("LOGO_DATA_URI");
    expect(source).not.toContain("PROJETO 30");
  });

  it("maps every one of the 10 SceneId values to a scene component - no achievement can hit an undefined scene", () => {
    const sceneIds = [
      "ascending-lines",
      "sunrise-glow",
      "ember-rise",
      "sequence-marks",
      "open-book",
      "speed-lines",
      "soft-light",
      "progress-marker",
      "loop-arc",
      "grid-bloom",
    ];
    const scenesBlock = source.slice(source.indexOf("const SCENES:"), source.indexOf("// --- Medal"));
    for (const id of sceneIds) {
      expect(scenesBlock).toContain(`"${id}"`);
    }
  });

  it("picks the rarity tier's colors from RARITY_TIERS, never a hardcoded/arbitrary color for the medal ring", () => {
    expect(source).toContain("const tier = RARITY_TIERS[content.rarityTier]");
    expect(source).toContain("tier.medalRing[0]");
    expect(source).toContain("tier.medalRing[1]");
  });

  it("reserves a larger top/bottom inset for the story format than feed - Instagram Stories safe area", () => {
    expect(source).toContain('const isStory = config.format === "story"');
    expect(source).toContain("const topInset = isStory ? 230 : 96");
    expect(source).toContain("const bottomInset = isStory ? 230 : 96");
  });

  it("truncates an overlong subtitle instead of letting it overflow the fixed canvas", () => {
    expect(source).toContain("content.subtitle.length > 140");
  });

  it("only shows micro-details (rarity/number/percent) that are actually known, joined without clutter when some are missing", () => {
    expect(source).toContain(
      "[content.rarityLabel, content.numberLabel, content.unlockedPercentLabel].filter(",
    );
  });
});
