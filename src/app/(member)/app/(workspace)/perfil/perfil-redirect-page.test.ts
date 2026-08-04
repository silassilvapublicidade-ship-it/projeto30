import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/perfil - permanent redirect to /app/dashboard (compatibility for old links/bookmarks)", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "perfil", "page.tsx");

  it("redirects to the new canonical dashboard route", () => {
    expect(source).toContain('import { redirect } from "next/navigation";');
    expect(source).toContain("redirect(`/app/dashboard");
  });

  it("preserves the query string, so old bookmarked filters (?desafio=, ?periodo=, ?timeline=) keep working", () => {
    expect(source).toContain("const params = await searchParams;");
    expect(source).toContain("query.set(key, value)");
    expect(source).toContain("redirect(`/app/dashboard${queryString ? `?${queryString}` : \"\"}`)");
  });

  it("never renders any dashboard UI itself - it's a pure redirect, no components imported", () => {
    expect(source).not.toContain("<Profile");
  });

  it("never fires profile_dashboard_viewed itself - only /app/dashboard does, avoiding a duplicate event per redirect hop (Parte I)", () => {
    expect(source).not.toContain("recordAnalyticsEvent");
  });
});

describe("/app/perfil/editar - configuracoes da conta, reachable from the avatar and from the Dashboard's edit button", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "perfil", "editar", "page.tsx");

  it("keeps every field the brief requires: photo, name/display name/city, read-only email, password, PWA install", () => {
    expect(source).toContain("<ProfilePhotoForm");
    expect(source).toContain("<ProfileDetailsForm");
    expect(source).toContain("<ProfileSecurityForm");
    expect(source).toContain("<InstallAppPrompt");
  });

  it("surfaces admin access only for admin roles, never unconditionally", () => {
    expect(source).toContain("{isAdminRole(profile.role) ? (");
  });

  it("links back to the dashboard - editing is never a dead end", () => {
    expect(source).toContain('href="/app/perfil"');
  });

  it("makes notification preferences discoverable from account settings", () => {
    expect(source).toContain('href="/app/configuracoes/notificacoes"');
  });
});
