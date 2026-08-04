import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "components", "member", "snapshot-share-button.tsx"), "utf8");
}

describe("SnapshotShareButton - retry fix (Correções obrigatórias pré-lançamento, Parte C)", () => {
  const source = readSource();

  it("is a client component offering both formats via the enrollment-anchored route", () => {
    expect(source.trimStart().startsWith('"use client";')).toBe(true);
    expect(source).toContain("`/api/progress-share/enrollment/${enrollmentId}?kind=${kind}&format=${format}`");
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

  it("retry replays the last attempted format, never the old result?.format pattern", () => {
    expect(source).toContain("onClick={() => lastAttemptedFormat && handleGenerate(lastAttemptedFormat)}");
    expect(source).not.toContain("onClick={() => result?.format && handleGenerate(result.format)}");
  });

  it("guards against a double click firing two requests for the same click", () => {
    expect(source).toContain("if (loadingFormat) return;");
  });

  it("keeps Web Share and download working exactly as before - only the retry wiring changed", () => {
    expect(source).toContain("navigator.canShare?.({ files: [file] })");
    expect(source).toContain('void recordProfileDashboardEventAction("evolution_share_downloaded");');
  });
});
