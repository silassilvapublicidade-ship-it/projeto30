import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("tips.service - display window (starts_at/ends_at)", () => {
  const source = readSource("src", "server", "services", "tips.service.ts");

  it("every published-only query also applies the starts_at/ends_at window", () => {
    const queryFunctions = ["getPublishedTips", "getTipCategories", "getTipBySlug", "getTipsForChallenge"];

    for (const fnName of queryFunctions) {
      const start = source.indexOf(`export async function ${fnName}`);
      expect(start, `${fnName} should exist`).toBeGreaterThan(-1);
      const nextFnStart = source.indexOf("export async function", start + 1);
      const body = source.slice(start, nextFnStart === -1 ? undefined : nextFnStart);
      expect(body, `${fnName} should filter by startsFilter`).toContain(".or(startsFilter)");
      expect(body, `${fnName} should filter by endsFilter`).toContain(".or(endsFilter)");
    }
  });

  it("computes 'now' fresh on every call, never a module-load-time constant", () => {
    const helperStart = source.indexOf("function displayWindowFilters");
    const helperBody = source.slice(helperStart, helperStart + 400);
    expect(helperBody).toContain("new Date().toISOString()");
  });

  it("exposes alt_text on both the summary and detail shapes", () => {
    expect(source).toContain('"alt_text"');
    expect(source).toContain("alt_text");
  });
});

describe("tips.service - alt_text is selected in both queries", () => {
  const source = readSource("src", "server", "services", "tips.service.ts");

  it("summaryColumns includes alt_text", () => {
    const summaryColumnsMatch = source.match(/const summaryColumns =\s*"([^"]+)"/);
    expect(summaryColumnsMatch?.[1]).toContain("alt_text");
  });

  it("detailColumns includes alt_text", () => {
    const detailColumnsMatch = source.match(/const detailColumns =\s*\n?\s*"([^"]+)"/);
    expect(detailColumnsMatch?.[1]).toContain("alt_text");
  });
});
