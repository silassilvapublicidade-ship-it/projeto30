import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "member", "achievement-art-share-button.tsx"), "utf8");
}

describe("AchievementArtShareButton - retry fix (Correções obrigatórias pré-lançamento, Parte C)", () => {
  const source = readSource();

  it("previously had NO retry affordance at all on error - now offers one, same pattern as the other 2 share buttons", () => {
    expect(source).toContain("Tentar de novo");
  });

  it("tracks the attempted format independently, set BEFORE the request fires", () => {
    const fnStart = source.indexOf("async function handleGenerate");
    const fnBody = source.slice(fnStart, source.indexOf("\n  }\n", fnStart));
    const setAttemptAt = fnBody.indexOf("setLastAttemptedFormat(format)");
    const fetchAt = fnBody.indexOf("await fetch(");
    expect(setAttemptAt).toBeGreaterThan(-1);
    expect(fetchAt).toBeGreaterThan(-1);
    expect(setAttemptAt).toBeLessThan(fetchAt);
  });

  it("retry replays the last attempted format", () => {
    expect(source).toContain("onClick={() => lastAttemptedFormat && handleGenerate(lastAttemptedFormat)}");
  });

  it("guards against a double click firing two requests for the same click", () => {
    expect(source).toContain("if (loadingFormat) return;");
  });
});
