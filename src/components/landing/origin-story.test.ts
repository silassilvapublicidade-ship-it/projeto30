import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "landing", "origin-story.tsx"), "utf8");
}

describe("OriginStory", () => {
  const source = readSource();

  it("mentions the real transformation (30kg) to ground the story in fact", () => {
    expect(source).toMatch(/30 quilos/);
  });

  it("mentions Silas by name and links to the full story on /sobre", () => {
    expect(source).toContain("Silas");
    expect(source).toContain('href="/sobre"');
  });

  it("is a short summary, not a duplicate of the full /sobre narrative", () => {
    expect(source.length).toBeLessThan(2000);
  });
});
