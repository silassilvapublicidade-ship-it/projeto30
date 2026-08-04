import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("ProgressShareButton (Parte D/23)", () => {
  const source = readSource("src", "components", "member", "progress-share-button.tsx");

  it("is a client component", () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
  });

  it("never generates a card automatically - requires an explicit click to even show the format choice", () => {
    expect(source).toContain("if (!open) {");
    expect(source).toContain("onClick={() => setOpen(true)}");
  });

  it("offers both Story and Feed formats", () => {
    expect(source).toContain('(["story", "feed"] as const)');
  });

  it("calls the dedicated progress-share route with both the kind and the format", () => {
    expect(source).toContain("`/api/progress-share/${dailyLogId}?kind=${kind}&format=${format}`");
  });

  it("tries the Web Share API with the actual image file first, same pattern as the achievement share button", () => {
    expect(source).toContain("navigator.canShare?.({ files: [file] })");
    expect(source).toContain("navigator.share({ files: [file], title: label });");
  });

  it("offers a download fallback and fires evolution_share_downloaded on click", () => {
    expect(source).toContain('download={`projeto30-${kind}-${result.format}.png`}');
    expect(source).toContain('void recordProfileDashboardEventAction("evolution_share_downloaded");');
  });

  it("shows an error with a retry action, never a silent failure", () => {
    expect(source).toContain("Tentar de novo");
  });

  it("keeps a textual fallback visible so sharing never fully breaks when no image has been generated yet", () => {
    expect(source).toContain("Prefere só compartilhar o texto?");
  });

  it("never includes an email placeholder in the share text", () => {
    expect(source).not.toMatch(/email/i);
  });
});

describe("/api/progress-share/[dailyLogId] route", () => {
  const source = readSource("src", "app", "api", "progress-share", "[dailyLogId]", "route.ts");

  it("requires auth before anything else", () => {
    expect(source).toContain('await requireAuthUser("/app/dashboard");');
  });

  it("validates the daily log id, format and kind before calling the generator", () => {
    expect(source).toContain("dailyLogIdSchema.safeParse(rawDailyLogId)");
    expect(source).toContain("shareCardFormatParamSchema.safeParse(url.searchParams.get(\"format\"))");
    expect(source).toContain("progressCardKindParamSchema.safeParse(url.searchParams.get(\"kind\"))");
  });

  it("fires evolution_share_started before generating and evolution_share_completed after - never duplicated, never the achievement-specific event names", () => {
    expect(source).toContain('eventName: "evolution_share_started"');
    expect(source).toContain('eventName: "evolution_share_completed"');
    expect(source).not.toContain("share_achievement_started");
  });

  it("maps a not-found error to 404, everything else to 500", () => {
    expect(source).toContain('result.error.includes("encontrado")');
  });
});
