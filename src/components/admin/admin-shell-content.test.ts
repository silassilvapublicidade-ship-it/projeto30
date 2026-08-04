import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readAdminShellSource() {
  return readFileSync(join(process.cwd(), "src", "components", "admin", "admin-shell.tsx"), "utf8");
}

describe("admin shell - return to app link", () => {
  const source = readAdminShellSource();

  it("links back to /app/dashboard - an admin returning to the member area lands on the Dashboard, same as any other entry point", () => {
    const returnLinkMatches = source.match(/href="\/app\/dashboard"/g) ?? [];
    expect(returnLinkMatches.length).toBeGreaterThanOrEqual(2); // desktop + mobile
  });

  it("labels the desktop return action clearly", () => {
    expect(source).toContain("Voltar para o aplicativo");
  });

  it("renders as a plain navigation link, not a form action (no logout side effect)", () => {
    const returnButtonBlock = source.split('href="/app/dashboard"')[1]?.slice(0, 200) ?? "";
    expect(returnButtonBlock).not.toContain("signOutAndRedirectAction");
  });

  it("is available on both desktop (sidebar) and mobile (header)", () => {
    const asideMatch = source.match(/<aside[\s\S]*?<\/aside>/);
    const headerMatch = source.match(/<header[\s\S]*?<\/header>/);
    expect(asideMatch?.[0]).toContain('href="/app/dashboard"');
    expect(headerMatch?.[0]).toContain('href="/app/dashboard"');
  });
});
