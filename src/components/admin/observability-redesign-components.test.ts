import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(name: string) {
  return readFileSync(join(process.cwd(), "src", "components", "admin", name), "utf8");
}

describe("StatLine", () => {
  const source = readSource("stat-line.tsx");

  it("guards against overflow: min-w-0 and break-words on the text, never a bare long string", () => {
    expect(source).toContain("min-w-0 break-words");
  });

  it("a zero/positive value reads as reassuring (checkmark, muted), an attention value is visually emphasized", () => {
    expect(source).toContain("positive:");
    expect(source).toContain("attention:");
    expect(source).toContain('tone === "attention" ? "font-semibold text-foreground" : "text-muted"');
  });
});

describe("ObservabilitySection (collapsible)", () => {
  const source = readSource("observability-section.tsx");

  it("uses native details/summary - progressive enhancement, no client JS required", () => {
    expect(source).toContain("<details");
    expect(source).toContain("<summary");
  });

  it("supports defaultOpen so important sections aren't hidden behind a closed accordion", () => {
    expect(source).toContain("defaultOpen = false");
    expect(source).toContain("open={defaultOpen}");
  });

  it("the title never overflows - truncate on a min-w-0 wrapper", () => {
    expect(source).toContain("min-w-0 items-center gap-2");
    expect(source).toContain("truncate text-base font-semibold");
  });
});

describe("CockpitBlockCard reused by the Central Operacional executive summary", () => {
  const source = readSource("cockpit-block-card.tsx");

  it("headline and description wrap safely instead of overflowing a compact card", () => {
    expect(source).toContain("flex h-full flex-col");
  });
});
