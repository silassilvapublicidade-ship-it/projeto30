import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ACHIEVEMENT_ICONS } from "@/features/admin/admin-achievements.schemas";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "rendering", "achievement-icons.tsx"), "utf8");
}

describe("achievement-icons.tsx", () => {
  const source = readSource();

  it("never imports lucide-react - its Icon component carries a top-level use client directive that next/og's server-side ImageResponse can't call", () => {
    expect(source).not.toContain("from \"lucide-react\"");
    expect(source).not.toContain("from 'lucide-react'");
  });

  it("defines raw vector data for every one of the 16 documented achievement icons - exhaustive by construction (Record type)", () => {
    for (const icon of ACHIEVEMENT_ICONS) {
      expect(source, `missing ICON_NODES entry for "${icon}"`).toContain(
        icon.includes("-") ? `"${icon}":` : `${icon}:`,
      );
    }
  });

  it("falls back to trophy for a null/unrecognized icon name - a medal must always render something", () => {
    expect(source).toContain("ICON_NODES[icon as AchievementIconName] ?? ICON_NODES.trophy");
  });

  it("renders as real SVG (viewBox + stroke-based paths), matching lucide's own visual style", () => {
    expect(source).toContain('viewBox: "0 0 24 24"');
    expect(source).toContain('fill: "none"');
    expect(source).toContain("stroke: props.color");
  });

  it("exports both the achievement medal icon and the standalone check-circle seal icon, sharing one render helper", () => {
    expect(source).toContain("export function AchievementIcon(");
    expect(source).toContain("export function CheckCircleIcon(");
    expect(source).toContain("function renderIconNodes(");
  });
});
