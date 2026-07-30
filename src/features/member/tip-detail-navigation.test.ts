import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("tip detail route - navigation UX", () => {
  const detailDir = ["src", "app", "(member)", "app", "(workspace)", "dicas", "[slug]"];

  it("has its own loading.tsx instead of inheriting the gallery grid skeleton", () => {
    const loadingPath = join(process.cwd(), ...detailDir, "loading.tsx");
    expect(existsSync(loadingPath), "[slug]/loading.tsx should exist").toBe(true);

    const loadingSource = readFileSync(loadingPath, "utf8");
    expect(loadingSource).not.toContain("grid-cols");
    expect(loadingSource).toContain("aspect-[4/5]");
  });

  it("renders ScrollToTopOnMount so soft navigation doesn't leave the page mid-scroll", () => {
    const pageSource = readSource(...detailDir, "page.tsx");
    expect(pageSource).toContain(
      '@/components/member/scroll-to-top-on-mount"',
    );
    expect(pageSource).toContain("<ScrollToTopOnMount />");
  });
});

describe("ScrollToTopOnMount component", () => {
  const source = readSource(
    "src",
    "components",
    "member",
    "scroll-to-top-on-mount.tsx",
  );

  it("is a client component", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("scrolls to top only once on mount, not on every render", () => {
    const effectStart = source.indexOf("useEffect(");
    expect(effectStart).toBeGreaterThan(-1);
    const effectEnd = source.indexOf("}, []);", effectStart);
    expect(effectEnd, "effect should close with an empty dependency array").toBeGreaterThan(-1);
    const effectBody = source.slice(effectStart, effectEnd);
    expect(effectBody).toContain("window.scrollTo(0, 0)");
  });
});
