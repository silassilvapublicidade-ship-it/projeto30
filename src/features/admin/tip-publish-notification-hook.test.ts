import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("publishTipAction - new-tip notification opt-in hook", () => {
  const source = readSource("src", "features", "admin", "admin-tips.actions.ts");
  const fn = source.slice(
    source.indexOf("export async function publishTipAction"),
    source.indexOf("export async function", source.indexOf("export async function publishTipAction") + 10),
  );

  it("only notifies when the explicit notifyUsers checkbox was checked on THIS submission", () => {
    expect(fn).toContain('const notifyUsers = formData.get("notifyUsers") === "on";');
    expect(fn).toContain("if (notifyUsers) {");
  });

  it("never fires from unpublishTipAction or archiveTipAction - the hook only exists inside publishTipAction", () => {
    const unpublishStart = source.indexOf("export async function unpublishTipAction");
    const archiveStart = source.indexOf("export async function archiveTipAction");
    const unpublishFn = source.slice(unpublishStart, source.indexOf("export async function", unpublishStart + 10));
    const archiveFn = source.slice(archiveStart, source.indexOf("export async function", archiveStart + 10));
    expect(unpublishFn).not.toContain("runNewTipPublishedAutomation");
    expect(archiveFn).not.toContain("runNewTipPublishedAutomation");
  });

  it("keys the notification on this call's own timestamp, not the tip's stored published_at - so a re-publish with a fresh confirmation can notify again", () => {
    expect(fn).toContain("publishedAt: new Date().toISOString()");
  });

  it("does not touch the Dicas publish/status logic itself - the update payload is unchanged by the hook", () => {
    expect(fn).toContain("status: \"published\"");
    expect(fn).toContain("published_at: tip.published_at ?? new Date().toISOString()");
  });
});

describe("TipRowActions - explicit per-action notify checkbox surfaced as a distinct menu item", () => {
  const source = readSource("src", "components", "admin", "tip-row-actions.tsx");

  it("offers a separate 'avisar usuários' action alongside the plain publish action, never auto-checked", () => {
    expect(source).toContain('extraFields={{ notifyUsers: "on" }}');
    expect(source).toContain("Publicar e avisar usuários");
  });
});
