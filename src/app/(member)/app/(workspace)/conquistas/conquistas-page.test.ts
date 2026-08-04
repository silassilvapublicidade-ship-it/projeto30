import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/conquistas (Refinamento premium, Parte B itens 2/3/6)", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "conquistas", "page.tsx");

  it("never falls back to a bare paragraph for the unlocked/locked empty states - both use EmptyState", () => {
    expect(source).toContain('import { EmptyState } from "@/components/ui/feedback";');
    expect((source.match(/<EmptyState/g) ?? []).length).toBe(2);
  });

  it("the locked-achievement progress bar exposes real values to screen readers via role=progressbar", () => {
    expect(source).toContain('role="progressbar"');
    expect(source).toContain("aria-valuenow={achievement.progress.current}");
    expect(source).toContain("aria-valuemax={achievement.progress.target}");
  });

  it("the progress fill and unlocked cards use the shared motion tokens, never an arbitrary duration", () => {
    expect(source).toContain("duration-[var(--motion-progress)]");
    expect(source).toContain("duration-[var(--motion-hover)]");
  });

  it("unlocked cards elevate on desktop hover and give touch feedback on press, never a continuous animation", () => {
    expect(source).toContain("sm:hover:-translate-y-0.5");
    expect(source).toContain("active:scale-[0.99]");
  });
});

describe("/app/conquistas - dedicated loading skeleton", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "conquistas", "loading.tsx");

  it("exists as its own file, never re-exporting or importing the generic workspace skeleton", () => {
    expect(source).not.toContain("WorkspaceLoading");
    expect(source).not.toMatch(/from ["'].*\(workspace\)\/loading["']/);
  });

  it("mirrors the real page's two sections (unlocked/locked), each with its own card grid", () => {
    expect((source.match(/grid gap-3 sm:grid-cols-2 lg:grid-cols-3/g) ?? []).length).toBe(2);
  });
});
