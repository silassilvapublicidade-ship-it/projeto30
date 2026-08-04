import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/perfil - Dashboard de Evolucao Pessoal wiring (Partes 2-13)", () => {
  const source = readSource(
    "src",
    "app",
    "(member)",
    "app",
    "(workspace)",
    "perfil",
    "page.tsx",
  );

  it("orchestrates every dashboard section - header, metrics, highlight, objective, faith, challenges, timeline, achievements, statistics, recent evolution", () => {
    expect(source).toContain("<ProfileHeader");
    expect(source).toContain("<ProfileMetricsGrid");
    expect(source).toContain("<ProfileEvolutionHighlight");
    expect(source).toContain("<ProfileNextObjective");
    expect(source).toContain("<ProfileFaithMessage");
    expect(source).toContain("<ProfileChallengesSection");
    expect(source).toContain("<ProfileTimeline");
    expect(source).toContain("<ProfileAchievementsSummary");
    expect(source).toContain("<ProfileStatistics");
    expect(source).toContain("<ProfileRecentEvolution");
  });

  it("the primary enrollment is the same representative pick used elsewhere (status-ranked, RPC-ordered) - never a second competing heuristic", () => {
    expect(source).toContain("const primaryEnrollment = overview.enrollments[0] ?? null;");
  });

  it("privacy: the ?desafio= filter is only honored when it matches a real enrollment of THIS user - never an arbitrary id passed straight to the RPC", () => {
    expect(source).toContain(
      "desafio && overview.enrollments.some((enrollment) => enrollment.challengeId === desafio) ? desafio : null;",
    );
  });

  it("records profile_dashboard_viewed server-side on every load, with no personal metadata", () => {
    expect(source).toContain('eventName: "profile_dashboard_viewed"');
    expect(source).toContain('source: "server"');
  });

  it("never surfaces a locked achievement's identity ahead of unlocking it - next objective only names achievements with real numeric progress", () => {
    expect(source).toContain("findClosestLockedAchievement(achievements.locked)");
  });

  it("reuses getMemberAchievements (the same source as /app/conquistas) instead of a duplicate query", () => {
    expect(source).toContain(
      'import { getMemberAchievements } from "@/server/services/achievements.service";',
    );
  });

  it("timeline is paginated server-side with a bounded page size, never the full dataset", () => {
    expect(source).toContain("const TIMELINE_PAGE_SIZE = 15;");
    expect(source).toContain("limit: TIMELINE_PAGE_SIZE");
  });

  it("recent-evolution period defaults to 7 and only accepts 30 explicitly - never an arbitrary caller-supplied window", () => {
    expect(source).toContain('const period = periodo === "30" ? 30 : 7;');
  });
});

describe("/app/perfil - dedicated loading skeleton (Parte 20)", () => {
  const source = readSource(
    "src",
    "app",
    "(member)",
    "app",
    "(workspace)",
    "perfil",
    "loading.tsx",
  );

  it("exists as its own file, never re-exporting or importing the Hoje skeleton", () => {
    expect(source).not.toContain("HojeLoading");
    expect(source).not.toMatch(/from ["'].*\/hoje\/loading["']/);
  });

  it("mirrors the real dashboard's section shapes (metrics grid, challenge cards, timeline) to avoid layout shift", () => {
    expect(source).toContain("grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6");
    expect(source).toContain("grid gap-3 sm:grid-cols-2 lg:grid-cols-3");
  });
});

describe("/app/perfil/editar - configuracoes da conta (Parte 14)", () => {
  const source = readSource(
    "src",
    "app",
    "(member)",
    "app",
    "(workspace)",
    "perfil",
    "editar",
    "page.tsx",
  );

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
