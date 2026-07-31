import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("next.config.ts - service worker headers", () => {
  const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

  it("forces revalidation on /sw.js so a new deploy is never masked by a stale cached copy", () => {
    const headersStart = source.indexOf('source: "/sw.js"');
    expect(headersStart).toBeGreaterThan(-1);
    const block = source.slice(headersStart, source.indexOf("],", headersStart));
    expect(block).toContain('"Cache-Control"');
    expect(block).toContain('"no-cache"');
    expect(block).toContain('"Service-Worker-Allowed"');
  });
});
