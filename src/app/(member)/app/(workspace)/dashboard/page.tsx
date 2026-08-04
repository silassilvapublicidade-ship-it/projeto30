import type { Metadata } from "next";

import { ProfileAchievementsSummary } from "@/components/member/profile-achievements-summary";
import { ProfileChallengesSection } from "@/components/member/profile-challenges-section";
import { ProfileEvolutionHighlight } from "@/components/member/profile-evolution-highlight";
import { ProfileFaithMessage } from "@/components/member/profile-faith-message";
import { ProfileHeader } from "@/components/member/profile-header";
import { ProfileMetricsGrid } from "@/components/member/profile-metrics-grid";
import { ProfileNextObjective } from "@/components/member/profile-next-objective";
import { ProfileRecentEvolution } from "@/components/member/profile-recent-evolution";
import { ProfileStatistics } from "@/components/member/profile-statistics";
import { ProfileTimeline } from "@/components/member/profile-timeline";
import {
  describeEvolutionHighlight,
  describeNextObjective,
  findClosestLockedAchievement,
  getTimelineFilterTypes,
  TIMELINE_FILTERS,
  type TimelineFilterKey,
} from "@/features/profile/profile-evolution.core";
import { getMemberAchievements } from "@/server/services/achievements.service";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { getMemberContext } from "@/server/services/member-area.service";
import {
  getFaithMessage,
  getPrimaryEnrollmentDayOverDayMessage,
  getProfileOverview,
  getProfileTimeline,
  getRecentEvolutionDays,
} from "@/server/services/profile-dashboard.service";

export const metadata: Metadata = {
  title: "Dashboard",
};

const TIMELINE_PAGE_SIZE = 15;

function isTimelineFilterKey(value: string | undefined): value is TimelineFilterKey {
  return TIMELINE_FILTERS.some((filter) => filter.key === value);
}

type DashboardPageProps = {
  searchParams: Promise<{ desafio?: string; periodo?: string; timeline?: string }>;
};

/**
 * Dashboard de Evolucao Pessoal - entrada principal da area de membros
 * (rodada de navegacao: antes vivia em /app/perfil, que agora e so um
 * redirect permanente para ca). Uma unica RPC agregada
 * (member_profile_overview) cobre cabecalho + metricas + "meus desafios"; a
 * timeline usa sua propria RPC paginada por cursor composto; conquistas e
 * estatisticas reaproveitam getMemberAchievements (mesma fonte de /app/
 * conquistas, nunca duplicada). Filtros de desafio/periodo/timeline vivem
 * na URL - nunca estado de cliente - para o dashboard inteiro continuar
 * navegavel e compartilhavel.
 */
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { desafio, periodo, timeline } = await searchParams;
  const period = periodo === "30" ? 30 : 7;
  const timelineFilter: TimelineFilterKey = isTimelineFilterKey(timeline) ? timeline : "all";

  const context = await getMemberContext();
  const profile = context.profile;
  const displayName = profile.display_name || profile.name || profile.email;
  const timezone = profile.timezone || "America/Sao_Paulo";

  const [overview, achievements] = await Promise.all([getProfileOverview(), getMemberAchievements()]);

  const primaryEnrollment = overview.enrollments[0] ?? null;
  const selectedChallengeId =
    desafio && overview.enrollments.some((enrollment) => enrollment.challengeId === desafio) ? desafio : null;

  const [dayOverDayMessage, recentEvolutionDays, faithMessage, timelinePage] = await Promise.all([
    primaryEnrollment
      ? getPrimaryEnrollmentDayOverDayMessage({ enrollmentId: primaryEnrollment.enrollmentId, timezone })
      : Promise.resolve(null),
    primaryEnrollment
      ? getRecentEvolutionDays({ days: period, enrollmentId: primaryEnrollment.enrollmentId, timezone })
      : Promise.resolve([]),
    getFaithMessage(),
    getProfileTimeline({
      challengeId: selectedChallengeId ?? undefined,
      limit: TIMELINE_PAGE_SIZE,
      types: getTimelineFilterTypes(timelineFilter) ?? undefined,
    }),
  ]);

  void recordAnalyticsEvent({
    challengeId: primaryEnrollment?.challengeId ?? null,
    enrollmentId: primaryEnrollment?.enrollmentId ?? null,
    eventName: "profile_dashboard_viewed",
    source: "server",
  });

  const closestLockedAchievement = findClosestLockedAchievement(achievements.locked);

  const evolutionHighlight = describeEvolutionHighlight({
    currentDay: primaryEnrollment?.currentDay ?? null,
    dayOverDayMessage,
    daysFinalized: overview.totals.daysFinalized,
    daysRemainingInChallenge:
      primaryEnrollment && primaryEnrollment.status === "active"
        ? primaryEnrollment.durationDays - primaryEnrollment.currentDay
        : null,
    durationDays: primaryEnrollment?.durationDays ?? null,
    streakBest: overview.totals.streakBestMax,
    streakCurrent: overview.totals.streakCurrentMax,
  });

  const nextObjective = describeNextObjective({
    closestLockedAchievement,
    currentDay: primaryEnrollment?.currentDay ?? null,
    durationDays: primaryEnrollment?.durationDays ?? null,
    streakBest: overview.totals.streakBestMax,
    streakCurrent: overview.totals.streakCurrentMax,
  });

  return (
    <div className="space-y-8">
      <ProfileHeader
        avatarUrl={profile.avatar_url}
        displayName={displayName}
        fullName={profile.name}
        joinedAt={overview.joinedAt}
        primaryChallengeName={primaryEnrollment?.status === "active" ? primaryEnrollment.challengeName : null}
        role={profile.role}
      />

      <ProfileMetricsGrid
        enrollments={overview.enrollments}
        selectedChallengeId={selectedChallengeId}
        totals={overview.totals}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ProfileEvolutionHighlight message={evolutionHighlight} />
        <ProfileNextObjective message={nextObjective} />
      </div>

      <ProfileFaithMessage message={faithMessage} />

      <ProfileChallengesSection enrollments={overview.enrollments} />

      <ProfileTimeline
        activeFilter={timelineFilter}
        challengeId={selectedChallengeId}
        initialHasMore={timelinePage.hasMore}
        initialItems={timelinePage.items}
        initialNextCursorAt={timelinePage.nextCursorAt}
        initialNextCursorId={timelinePage.nextCursorId}
      />

      <ProfileAchievementsSummary
        displayName={displayName}
        recent={achievements.unlocked.slice(0, 3)}
        totalUnlocked={achievements.unlocked.length}
      />

      <ProfileStatistics totals={overview.totals} />

      <ProfileRecentEvolution days={recentEvolutionDays} period={period} />
    </div>
  );
}
