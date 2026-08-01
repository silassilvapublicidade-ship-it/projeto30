import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

/**
 * Regression coverage for Dicas instrumentation: before Module D, zero
 * events existed for /app/dicas, so admin_tips_analytics always returned
 * zeroes. Each of the 3 read paths must fire its matching event exactly
 * once, with contentItemId set, so per-card analytics can attribute views/
 * opens/downloads correctly.
 */
describe("tips.service - analytics instrumentation", () => {
  const source = readSource("src", "server", "services", "tips.service.ts");

  it("imports recordAnalyticsEvent", () => {
    expect(source).toContain('import { recordAnalyticsEvent } from "./analytics.service";');
  });

  it("getPublishedTips records tip_card_viewed once per card actually returned in the gallery", () => {
    const start = source.indexOf("export async function getPublishedTips");
    const end = source.indexOf("export async function getTipBySlug");
    const body = source.slice(start, end);

    expect(body).toContain('eventName: "tip_card_viewed"');
    expect(body).toContain("contentItemId: tip.id");
    expect(body).toContain("tips.map((tip) =>");
  });

  it("getTipBySlug records tip_card_opened only when the card was actually found", () => {
    const start = source.indexOf("export async function getTipBySlug");
    const end = source.indexOf("export type TipDownload");
    const body = source.slice(start, end);

    expect(body).toContain("if (data) {");
    const beforeGuard = body.split("if (data) {")[0];
    expect(beforeGuard).not.toContain("recordAnalyticsEvent");
    expect(body).toContain('eventName: "tip_card_opened"');
    expect(body).toContain("contentItemId: data.id");
  });
});

describe("dicas download route - analytics instrumentation", () => {
  const source = readSource("src", "app", "api", "dicas", "[id]", "download", "route.ts");

  it("records tip_card_downloaded only after the file was actually located and downloaded, not on 404s", () => {
    const bodyStart = source.indexOf("export async function GET");
    const notFoundBranches = source.slice(bodyStart).split("return NextResponse.json");
    for (const branch of notFoundBranches.slice(0, -1)) {
      expect(branch).not.toContain("recordAnalyticsEvent(");
    }

    expect(source).toContain('eventName: "tip_card_downloaded"');
    expect(source).toContain("contentItemId: tip.id");

    const recordIndex = source.indexOf("recordAnalyticsEvent(");
    const responseIndex = source.indexOf("new NextResponse(bytes");
    expect(recordIndex).toBeGreaterThan(-1);
    expect(responseIndex).toBeGreaterThan(recordIndex);
  });
});

describe("analytics.service - tip event names and content_item_id plumbing", () => {
  const source = readSource("src", "server", "services", "analytics.service.ts");

  it("extends the event name union with the 3 tip events", () => {
    for (const eventName of ["tip_card_viewed", "tip_card_opened", "tip_card_downloaded"]) {
      expect(source).toContain(`"${eventName}"`);
    }
  });

  it("accepts an optional contentItemId and forwards it as p_content_item_id only when set", () => {
    expect(source).toContain("contentItemId?: string | null");
    expect(source).toContain("input.contentItemId");
    expect(source).toContain("p_content_item_id");
  });
});
