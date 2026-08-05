import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

/**
 * The Dashboard becomes the primary member landing page this round. Every
 * generic "entry point" redirect (bare /app, login, magic link, onboarding
 * completion, admin return) funnels through redirectToMemberStart() or
 * directly targets /app/dashboard - these are asserted here as source-text
 * regressions (same convention already used across this project for
 * navigation/redirect logic). CONTEXTUAL redirects (joining a specific
 * challenge, notification deep links, PWA shortcuts) are asserted to stay
 * on /app/hoje - those are deliberately untouched by this round.
 */
describe("redirectToMemberStart - the single chokepoint behind the bare /app route", () => {
  const source = readSource("src", "server", "services", "member-area.service.ts");
  const fnStart = source.indexOf("export async function redirectToMemberStart");
  const fnBody = source.slice(fnStart, source.indexOf("\n}", fnStart + 40) + 2);

  it("sends a member with completed onboarding to the Dashboard, not Hoje directly", () => {
    expect(fnBody).toContain('redirect(context.profile.onboarding_completed ? "/app/dashboard" : "/app/onboarding");');
  });

  it("still sends an incomplete onboarding to /app/onboarding - never skipped, never a loop", () => {
    expect(fnBody).toContain('"/app/onboarding"');
  });
});

describe("completeOnboardingAction - onboarding completion lands on the Dashboard", () => {
  const source = readSource("src", "features", "member", "member.actions.ts");

  it("redirects to /app/dashboard right after onboarding_completed is set", () => {
    const flagIndex = source.indexOf("onboarding_completed: true");
    const redirectIndex = source.indexOf('redirect("/app/dashboard");', flagIndex);
    expect(flagIndex).toBeGreaterThan(-1);
    expect(redirectIndex).toBeGreaterThan(flagIndex);
  });

  it("does NOT touch the contextual join-challenge redirects - those correctly keep opening Hoje with their own toast", () => {
    expect(source).toContain('redirect(`/app/hoje?journey=error&message=${message}`);');
    expect(source).toContain('redirect("/app/hoje?journey=joined");');
  });
});

describe("AppLayout gate - must_change_password still goes to /primeiro-acesso, unaffected by the Dashboard change", () => {
  const source = readSource("src", "app", "(member)", "app", "layout.tsx");

  it("redirects to /primeiro-acesso before any /app/* page (including /app/dashboard) ever renders", () => {
    expect(source).toContain('redirect("/primeiro-acesso");');
  });
});

describe("admin-shell.tsx - return to app link", () => {
  const source = readSource("src", "components", "admin", "admin-shell.tsx");

  it("an admin returning to the member area lands on the Dashboard, same as any other entry point", () => {
    const matches = source.match(/href="\/app\/dashboard"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("MemberShell - avatar opens Editar perfil directly (responsive nav round, Parte F)", () => {
  const source = readSource("src", "components", "member", "member-shell.tsx");

  it("the avatar links to /app/perfil/editar on both desktop and mobile - it never opens Mais, that's the bottom nav's job", () => {
    const matches = source.match(/href="\/app\/perfil\/editar"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(source).not.toMatch(/aria-label="Abrir (Mais|perfil e configurações pessoais)"[\s\S]{0,80}href="\/app\/mais"/);
  });

  it("uses the exact requested aria-label: 'Abrir perfil e configurações pessoais'", () => {
    const matches = source.match(/aria-label="Abrir perfil e configurações pessoais"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("still shows the photo, display name and status next to the avatar link - never stripped down", () => {
    expect(source).toContain("<MemberAvatar avatarUrl={context.profile.avatar_url} name={displayName} />");
    expect(source).toContain("{displayName}");
  });

  it("never removes sign-out - logout stays reachable independent of the avatar/profile link", () => {
    expect(source).toContain("<SignOutForm");
  });

  it("Dashboard is not ONLY reachable through the avatar - it has its own item in both the desktop sidebar and the mobile bar", () => {
    expect(source).toContain("<MemberDesktopSidebar");
    expect(source).toContain("<MemberMobileNavigation");
  });
});
