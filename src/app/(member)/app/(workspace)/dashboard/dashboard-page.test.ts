import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("/app/dashboard - Dashboard de Evolucao Pessoal, entrada principal da area de membros", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "dashboard", "page.tsx");

  it("orchestrates every dashboard section - header, metrics, context message, next milestone, faith, challenges, timeline, achievements, statistics, recent evolution", () => {
    expect(source).toContain("<ProfileHeader");
    expect(source).toContain("<ProfileMetricsGrid");
    expect(source).toContain("<DashboardContextMessage");
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

  it("never surfaces a locked achievement's identity ahead of unlocking it - next milestone only names achievements with real numeric progress", () => {
    expect(source).toContain("findClosestLockedAchievement(achievements.locked)");
  });

  it("renders the next-milestone block only when a real milestone resolved (never a hardcoded placeholder)", () => {
    expect(source).toContain("<DashboardNextMilestone");
    expect(source).toContain("nextMilestone ? (");
  });

  it("central contextual message uses the 10-tier resolver, never scattered inline conditionals", () => {
    expect(source).toContain("resolveDashboardContextMessage(");
  });

  it("records dashboard_context_message_viewed with only the safe category, never the raw message text", () => {
    expect(source).toContain('eventName: "dashboard_context_message_viewed"');
    expect(source).toContain("category: contextMessage.category");
  });

  it("the narrative summary block exists and uses the dedicated pure builder, never inline copy", () => {
    expect(source).toContain("<DashboardNarrativeSummary");
    expect(source).toContain("buildNarrativeSummary(");
  });

  it("first fold follows the brief's exact order: mission, message, narrative summary, next milestone, metrics (Parte D item 12)", () => {
    const missionAt = source.indexOf("<DashboardMissionBlock");
    const messageAt = source.indexOf("<DashboardContextMessage");
    const summaryAt = source.indexOf("<DashboardNarrativeSummary");
    const milestoneAt = source.indexOf("<DashboardNextMilestone");
    const metricsAt = source.indexOf("<ProfileMetricsGrid");

    expect(missionAt).toBeGreaterThan(-1);
    expect(missionAt).toBeLessThan(messageAt);
    expect(messageAt).toBeLessThan(summaryAt);
    expect(summaryAt).toBeLessThan(milestoneAt);
    expect(milestoneAt).toBeLessThan(metricsAt);
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

  it("titles the tab 'Dashboard', not 'Perfil' - the route's own identity now, not a leftover from the old settings page", () => {
    expect(source).toContain('title: "Dashboard"');
  });
});

describe("/app/dashboard - dedicated loading skeleton", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "dashboard", "loading.tsx");

  it("exists as its own file, never re-exporting or importing the Hoje skeleton", () => {
    expect(source).not.toContain("HojeLoading");
    expect(source).not.toMatch(/from ["'].*\/hoje\/loading["']/);
  });

  it("mirrors the real dashboard's section shapes (metrics grid, challenge cards, timeline) to avoid layout shift", () => {
    expect(source).toContain("grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6");
    expect(source).toContain("grid gap-3 sm:grid-cols-2 lg:grid-cols-3");
  });
});
