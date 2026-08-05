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

  it("distinguishes the 3 dashboard states (Correções obrigatórias pré-lançamento, Parte A) from real enrollment data, never a second status heuristic", () => {
    expect(source).toContain("const hasAnyHistory = overview.enrollments.length > 0;");
    expect(source).toContain("const hasOngoingEnrollment = missionEnrollments.length > 0;");
  });

  it("state 1 (no history at all): renders only the premium hero, never the zeroed metrics/context-message/narrative-summary stack", () => {
    expect(source).toContain("{!hasAnyHistory ? (\n        <DashboardNewJourneyHero />");
  });

  it("state 2 (history, no ongoing enrollment): shows the explore-challenges banner but still renders the real history sections below it", () => {
    const bannerAt = source.indexOf("<DashboardExploreChallengesBanner");
    const metricsAt = source.indexOf("<ProfileMetricsGrid");
    const challengesAt = source.indexOf("<ProfileChallengesSection");
    const achievementsAt = source.indexOf("<ProfileAchievementsSummary");
    expect(source).toContain("{!hasOngoingEnrollment ? <DashboardExploreChallengesBanner /> : null}");
    expect(bannerAt).toBeGreaterThan(-1);
    expect(bannerAt).toBeLessThan(metricsAt);
    expect(metricsAt).toBeLessThan(challengesAt);
    expect(challengesAt).toBeLessThan(achievementsAt);
  });

  it("state 2 never renders the ongoing-cycle blocks (context message, narrative summary, next milestone, weekly share) - they'd describe a cycle that isn't happening", () => {
    const contextMessageAt = source.indexOf("<DashboardContextMessage");
    const guardAt = source.indexOf("{hasOngoingEnrollment ? (");
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(contextMessageAt);
  });

  it("state 3 (ongoing enrollment) is untouched: mission, context message, narrative summary, next milestone, metrics all still render for an active/paused user", () => {
    expect(source).toContain("<DashboardMissionBlock cards={missionCards} />");
    expect(source).toContain("<DashboardContextMessage message={contextMessage} />");
    expect(source).toContain("<DashboardNarrativeSummary summary={narrativeSummary} />");
  });

  it("only fires dashboard_context_message_viewed when the message actually rendered - never for a component the user never saw", () => {
    expect(source).toContain('if (hasOngoingEnrollment) {\n    void recordAnalyticsEvent({');
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

  it("only offers the weekly-summary share button when a real finalized day exists in the last 7 days, never unconditionally", () => {
    expect(source).toContain("recentEvolutionDays.slice(-7).some((day) => day.finalized)");
    expect(source).toContain('kind="weekly_summary"');
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

describe("/app/dashboard - feedback discoverability fix", () => {
  const source = readSource("src", "app", "(member)", "app", "(workspace)", "dashboard", "page.tsx");

  it("renders DashboardFeedbackFooter unconditionally - it's the one path reachable in at most 2 taps from any screen (Dashboard is a mainItem, reachable from the mobile bottom nav)", () => {
    expect(source).toContain("<DashboardFeedbackFooter />");
    // Outside the {!hasAnyHistory ? ... : (...)} branch, so new users see it too.
    const footerAt = source.indexOf("<DashboardFeedbackFooter");
    const branchCloseAt = source.lastIndexOf(")}", footerAt);
    expect(footerAt).toBeGreaterThan(branchCloseAt);
  });

  it("sits after every real content section - never in the first fold, never competing with the daily mission", () => {
    const missionAt = source.indexOf("<DashboardMissionBlock");
    const footerAt = source.indexOf("<DashboardFeedbackFooter");
    expect(footerAt).toBeGreaterThan(missionAt);
  });
});

describe("DashboardFeedbackFooter component", () => {
  const source = readSource("src", "components", "member", "dashboard-feedback-footer.tsx");

  it("links to both /app/feedback and /app/feedback/meus with the exact requested copy", () => {
    expect(source).toContain('href="/app/feedback"');
    expect(source).toContain('href="/app/feedback/meus"');
    expect(source).toContain("Ajude a melhorar o Projeto 30");
    expect(source).toContain(
      "Encontrou algum problema ou teve uma ideia? Seu feedback ajuda a tornar a experiência melhor para todos.",
    );
    expect(source).toContain("Enviar feedback");
    expect(source).toContain("Acompanhar meus feedbacks");
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
