import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("viewport-fit=cover is preserved", () => {
  it("app/layout.tsx still declares viewportFit: cover - required for these safe-area fixes to matter at all", () => {
    const source = readSource("src", "app", "layout.tsx");
    expect(source).toContain('viewportFit: "cover"');
  });
});

describe("Reusable safe-area utilities (globals.css)", () => {
  const css = readSource("src", "app", "globals.css");

  it("every safe-area CSS variable falls back to 0px, never a fixed guess", () => {
    expect(css).toContain("--safe-area-top: env(safe-area-inset-top, 0px);");
    expect(css).toContain("--safe-area-right: env(safe-area-inset-right, 0px);");
    expect(css).toContain("--safe-area-bottom: env(safe-area-inset-bottom, 0px);");
    expect(css).toContain("--safe-area-left: env(safe-area-inset-left, 0px);");
  });

  it("defines the raw composable inset utilities", () => {
    for (const name of ["safe-top", "safe-bottom", "safe-left", "safe-right", "safe-x", "safe-y", "safe-all"]) {
      expect(css, `@utility ${name} should exist`).toContain(`@utility ${name} {`);
    }
  });

  it("defines the 'at least existing spacing, or the device inset' utilities used by fixed/sticky chrome", () => {
    expect(css).toContain("@utility safe-padding {");
    expect(css).toContain("@utility safe-pt {");
    expect(css).toContain("@utility safe-fixed-top {");
    expect(css).toContain("@utility safe-fixed-bottom {");
    expect(css).toContain("@utility safe-scroll-pb {");
  });

  it("safe-fixed-bottom/top set position offsets (bottom/top), not padding - required for fixed inset-x-N bottom-N chrome", () => {
    const start = css.indexOf("@utility safe-fixed-bottom {");
    const block = css.slice(start, css.indexOf("}", start));
    expect(block).toContain("bottom: max(");
    expect(block).not.toContain("padding");
  });

  it("safe-scroll-pb reuses the existing --nav-bottom-height token instead of a new magic number", () => {
    const start = css.indexOf("@utility safe-scroll-pb {");
    const block = css.slice(start, css.indexOf("}", start));
    expect(block).toContain("var(--nav-bottom-height)");
    expect(block).toContain("var(--safe-area-bottom)");
  });
});

describe("Member and Admin shells respect Dynamic Island / Home Indicator", () => {
  const memberShell = readSource("src", "components", "member", "member-shell.tsx");
  const adminShell = readSource("src", "components", "admin", "admin-shell.tsx");

  for (const [name, source] of [
    ["MemberShell", memberShell],
    ["AdminShell", adminShell],
  ] as const) {
    it(`${name}: outer containers use dvh, not the old vh-based screen unit`, () => {
      expect(source).not.toContain("min-h-screen");
      expect(source).not.toMatch(/\bh-screen\b/);
      expect(source).toContain("min-h-dvh");
      expect(source).toContain("h-dvh");
    });

    it(`${name}: the grid reserves left/right safe area (covers the landscape case where the sidebar layout activates on wide phones)`, () => {
      expect(source).toContain("safe-x mx-auto grid");
    });

    it(`${name}: the mobile sticky header pads for the top inset instead of starting under the Dynamic Island`, () => {
      expect(source).toContain("safe-pt sticky top-0");
    });

    it(`${name}: scroll content gets safe-area-aware bottom clearance instead of a fixed pb-24 guess`, () => {
      expect(source).toContain("safe-scroll-pb");
      expect(source).not.toContain("pb-24");
    });
  }
});

describe("Bottom navigation respects the Home Indicator", () => {
  const memberNav = readSource("src", "components", "member", "member-navigation.tsx");
  const adminNav = readSource("src", "components", "admin", "admin-navigation.tsx");

  for (const [name, source] of [
    ["MemberMobileNavigation", memberNav],
    ["AdminMobileNavigation", adminNav],
  ] as const) {
    it(`${name}: uses safe-fixed-bottom instead of a hardcoded bottom-3`, () => {
      expect(source).toContain("safe-fixed-bottom fixed inset-x-3");
      expect(source).not.toMatch(/fixed inset-x-3 bottom-3\b/);
    });
  }
});

describe("PWA update banner respects the Home Indicator", () => {
  it("uses safe-fixed-bottom instead of a hardcoded bottom-4", () => {
    const source = readSource("src", "components", "pwa", "service-worker-manager.tsx");
    expect(source).toContain("safe-fixed-bottom fixed inset-x-4");
    expect(source).not.toMatch(/fixed inset-x-4 bottom-4\b/);
  });
});

describe("Public marketing header respects the top inset", () => {
  it("PublicHeader (the one actually imported by (public)/layout.tsx) pads for the top inset", () => {
    const source = readSource("src", "components", "public", "public-header.tsx");
    expect(source).toContain("safe-pt relative");
  });
});

describe("Remaining vh-based full-page containers converted to dvh", () => {
  it("(public) layout, onboarding and the app loading skeleton use min-h-dvh", () => {
    const publicLayout = readSource("src", "app", "(public)", "layout.tsx");
    const onboarding = readSource("src", "app", "(member)", "app", "onboarding", "page.tsx");
    const loading = readSource("src", "app", "(member)", "app", "loading.tsx");

    for (const [name, source] of [
      ["(public)/layout.tsx", publicLayout],
      ["onboarding/page.tsx", onboarding],
      ["app/loading.tsx", loading],
    ] as const) {
      expect(source, `${name} should not use min-h-screen`).not.toContain("min-h-screen");
      expect(source, `${name} should use min-h-dvh`).toContain("min-h-dvh");
    }
  });

  it("no min-h-screen/h-screen usage remains anywhere in src (the vh-based unit this round replaces)", () => {
    // A whole-repo sweep, not just the files this round touched - if a
    // future file reintroduces min-h-screen it should fail this test rather
    // than silently reintroduce the Safari toolbar-jump bug.
    const selfPath = join(process.cwd(), "src", "features", "layout", "safe-area.test.ts");
    const offenders: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      if (file === selfPath) continue;
      const content = readFileSync(file, "utf8");
      if (content.includes("min-h-screen") || /\bh-screen\b/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("TipImageViewer lightbox (previous round) already handles safe-area correctly - left untouched", () => {
  it("still reserves top and right insets for its control bar", () => {
    const source = readSource("src", "components", "member", "tip-image-viewer.tsx");
    expect(source).toContain("env(safe-area-inset-top)");
    expect(source).toContain("env(safe-area-inset-right)");
  });
});

describe("Auth shell (previous round) already handles top/bottom safe-area - left untouched", () => {
  it("still reserves top and bottom insets", () => {
    const source = readSource("src", "components", "auth", "auth-shell.tsx");
    expect(source).toContain("env(safe-area-inset-top)");
    expect(source).toContain("env(safe-area-inset-bottom)");
  });
});
