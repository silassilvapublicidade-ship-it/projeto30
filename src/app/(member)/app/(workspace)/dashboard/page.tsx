import type { Metadata } from "next";

import { DashboardContextMessage } from "@/components/member/dashboard-context-message";
import { DashboardMissionBlock, type MissionCardData } from "@/components/member/dashboard-mission-block";
import { DashboardNextMilestone } from "@/components/member/dashboard-next-milestone";
import { ProfileAchievementsSummary } from "@/components/member/profile-achievements-summary";
import { ProfileChallengesSection } from "@/components/member/profile-challenges-section";
import { ProfileFaithMessage } from "@/components/member/profile-faith-message";
import { ProfileHeader } from "@/components/member/profile-header";
import { ProfileMetricsGrid } from "@/components/member/profile-metrics-grid";
import { ProfileNextAchievement } from "@/components/member/profile-next-achievement";
import { ProfileRecentEvolution } from "@/components/member/profile-recent-evolution";
import { ProfileStatistics } from "@/components/member/profile-statistics";
import { ProfileTimeline } from "@/components/member/profile-timeline";
import { getDateOnlyInTimeZone, getPreviousDateOnly } from "@/features/challenges/date.core";
import { resolveDashboardContextMessage } from "@/features/dashboard/dashboard-context-message.core";
import {
  describeMissionCountdown,
  describeMissionState,
  describePointsContext,
} from "@/features/dashboard/dashboard-mission.core";
import {
  resolveNextMilestone,
  type NextMilestoneKind,
} from "@/features/dashboard/dashboard-next-milestone.core";
import {
  findClosestLockedAchievement,
  getTimelineFilterTypes,
  TIMELINE_FILTERS,
  type TimelineFilterKey,
} from "@/features/profile/profile-evolution.core";
import { getMemberAchievements } from "@/server/services/achievements.service";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { getMemberContext } from "@/server/services/member-area.service";
import {
  getDailyMissionMessage,
  getFaithMessage,
  getPointsEarnedThisWeek,
  getPrimaryEnrollmentDayOverDayMessage,
  getProfileOverview,
  getProfileTimeline,
  getRecentEvolutionDays,
} from "@/server/services/profile-dashboard.service";

export const metadata: Metadata = {
  title: "Dashboard",
};

const TIMELINE_PAGE_SIZE = 15;

/** Cada tipo de marco leva a uma tela diferente - nunca um href fixo para todos. */
const NEXT_MILESTONE_CTA_HREF: Record<NextMilestoneKind, string> = {
  complete_challenge: "/app/hoje",
  final_week: "/app/jornada",
  finish_day: "/app/hoje",
  reach_halfway: "/app/jornada",
  tie_record: "/app/jornada",
  unlock_achievement: "/app/conquistas",
};

function isTimelineFilterKey(value: string | undefined): value is TimelineFilterKey {
  return TIMELINE_FILTERS.some((filter) => filter.key === value);
}

type DashboardPageProps = {
  searchParams: Promise<{ desafio?: string; periodo?: string; timeline?: string }>;
};

/**
 * Dashboard de Evolucao Pessoal - entrada principal da area de membros.
 * "Sua missao de hoje" reaproveita getMemberContext() por inteiro (mesma
 * fonte que /app/hoje ja usa - context.enrollments) para responder "o que
 * eu preciso fazer agora?" na primeira dobra, sem nenhuma consulta nova:
 * so 2 leituras adicionais e pequenas quando fazem falta (pontos da
 * semana e a mensagem motivacional generica, so quando o dia nao tem
 * challenge_days.message proprio). member_profile_overview continua a
 * unica RPC agregada para cabecalho + metricas + "meus desafios"; a
 * timeline usa sua propria RPC paginada por cursor composto; conquistas e
 * estatisticas reaproveitam getMemberAchievements. Filtros de desafio/
 * periodo/timeline vivem na URL - nunca estado de cliente.
 */
export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { desafio, periodo, timeline } = await searchParams;
  const period = periodo === "30" ? 30 : 7;
  const timelineFilter: TimelineFilterKey = isTimelineFilterKey(timeline) ? timeline : "all";

  const context = await getMemberContext();
  const profile = context.profile;
  const displayName = profile.display_name || profile.name || profile.email;
  const timezone = profile.timezone || "America/Sao_Paulo";
  const today = getDateOnlyInTimeZone(new Date(), timezone);
  const yesterday = getPreviousDateOnly(today);

  const [overview, achievements] = await Promise.all([getProfileOverview(), getMemberAchievements()]);

  const primaryEnrollment = overview.enrollments[0] ?? null;
  const selectedChallengeId =
    desafio && overview.enrollments.some((enrollment) => enrollment.challengeId === desafio) ? desafio : null;

  // Missao de hoje - ativos primeiro, depois pausados, cada um com seus
  // proprios dados (nunca soma habitos/pontos entre desafios diferentes).
  const missionEnrollments = [...context.enrollments].sort((a, b) => {
    const rank = (status: string) => (status === "active" ? 0 : 1);
    return rank(a.enrollment.status) - rank(b.enrollment.status);
  });
  const primaryMission = missionEnrollments[0] ?? null;
  const missionNeedsGenericMessage = missionEnrollments.some(
    (enrollment) => !enrollment.todayChallengeDay?.message?.trim(),
  );

  const [
    dayOverDayMessage,
    recentEvolutionDays,
    faithMessage,
    timelinePage,
    pointsThisWeek,
    genericMissionMessage,
  ] = await Promise.all([
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
    primaryMission
      ? getPointsEarnedThisWeek({ enrollmentId: primaryMission.enrollment.id, timezone })
      : Promise.resolve(null),
    missionNeedsGenericMessage ? getDailyMissionMessage() : Promise.resolve(null),
  ]);

  void recordAnalyticsEvent({
    challengeId: primaryEnrollment?.challengeId ?? null,
    enrollmentId: primaryEnrollment?.enrollmentId ?? null,
    eventName: "dashboard_mission_opened",
    source: "server",
  });
  void recordAnalyticsEvent({
    challengeId: primaryEnrollment?.challengeId ?? null,
    enrollmentId: primaryEnrollment?.enrollmentId ?? null,
    eventName: "profile_dashboard_viewed",
    source: "server",
  });

  const missionCards: MissionCardData[] = missionEnrollments.map((dayContext) => {
    const enrollment = dayContext.enrollment;
    const challenge = enrollment.challenge;
    const isActive =
      enrollment.status === "active" &&
      (dayContext.journeyState === "day_available" || dayContext.journeyState === "day_finalized");

    const state = describeMissionState({
      challengeStartDate: challenge?.start_date ?? null,
      completionPercent: dayContext.todayProgress.completionPercent,
      journeyState: dayContext.journeyState,
      streakMinimumCompletion: dayContext.todayProgress.streakMinimumCompletion,
      todayProgressState: dayContext.todayProgress.state,
    });

    return {
      applicableHabits: dayContext.todayProgress.applicableHabits,
      challengeId: enrollment.challenge_id,
      challengeName: challenge?.name ?? "Desafio",
      completedHabits: dayContext.todayProgress.completedHabits,
      countdownMessage: describeMissionCountdown({
        currentDay: enrollment.current_day,
        durationDays: challenge?.duration_days ?? enrollment.current_day,
        isActive,
      }),
      cta: state.cta,
      currentDay: enrollment.current_day,
      durationDays: challenge?.duration_days ?? enrollment.current_day,
      enrollmentId: enrollment.id,
      motivationalMessage: dayContext.todayChallengeDay?.message?.trim() || genericMissionMessage?.body || null,
      pointsEarnedToday: dayContext.todayProgress.pointsEarned,
      stateKind: state.kind,
      streakBest: enrollment.streak_best,
      streakCurrent: enrollment.streak_current,
      title: state.title,
      todayDailyLogId: enrollment.todayLog?.id ?? null,
    };
  });

  const closestLockedAchievement = findClosestLockedAchievement(achievements.locked);
  const achievementsTotal = achievements.locked.length + achievements.unlocked.length;
  const pointsContext = describePointsContext({
    pointsThisWeek,
    pointsToday: primaryMission?.todayProgress.pointsEarned ?? null,
    pointsTotal: overview.totals.pointsTotal,
  });
  const pointsContextHint = pointsContext.todayLabel ?? pointsContext.weekLabel;

  const daysRemainingInChallenge =
    primaryEnrollment && primaryEnrollment.status === "active"
      ? primaryEnrollment.durationDays - primaryEnrollment.currentDay
      : null;

  const contextMessage = resolveDashboardContextMessage({
    challengeDayMessage: primaryMission?.todayChallengeDay?.message ?? null,
    closestLockedAchievement,
    currentDay: primaryEnrollment?.currentDay ?? null,
    dayOverDayMessage,
    daysFinalized: overview.totals.daysFinalized,
    daysRemainingInChallenge,
    durationDays: primaryEnrollment?.durationDays ?? null,
    faithMessage: faithMessage?.body ?? null,
    streakBest: overview.totals.streakBestMax,
    streakCurrent: overview.totals.streakCurrentMax,
    todayCompletionPercent: primaryMission?.todayProgress.completionPercent ?? null,
    todayFinalized: primaryMission?.todayProgress.state === "finalized",
  });

  void recordAnalyticsEvent({
    challengeId: primaryEnrollment?.challengeId ?? null,
    enrollmentId: primaryEnrollment?.enrollmentId ?? null,
    eventName: "dashboard_context_message_viewed",
    metadata: { category: contextMessage.category },
    source: "server",
  });

  const nextMilestone = resolveNextMilestone({
    applicableHabits: primaryMission?.todayProgress.applicableHabits ?? 0,
    closestLockedAchievement,
    completedHabits: primaryMission?.todayProgress.completedHabits ?? 0,
    currentDay: primaryEnrollment?.currentDay ?? null,
    daysRemainingInChallenge,
    durationDays: primaryEnrollment?.durationDays ?? null,
    streakBest: overview.totals.streakBestMax,
    streakCurrent: overview.totals.streakCurrentMax,
    todayFinalized: primaryMission?.todayProgress.state === "finalized",
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

      <DashboardMissionBlock cards={missionCards} />

      <DashboardContextMessage message={contextMessage} />

      <ProfileMetricsGrid
        achievementsTotal={achievementsTotal}
        enrollments={overview.enrollments}
        pointsContextHint={pointsContextHint}
        selectedChallengeId={selectedChallengeId}
        totals={overview.totals}
      />

      {nextMilestone ? (
        <DashboardNextMilestone
          challengeId={primaryEnrollment?.challengeId}
          ctaHref={NEXT_MILESTONE_CTA_HREF[nextMilestone.kind]}
          enrollmentId={primaryEnrollment?.enrollmentId}
          milestone={nextMilestone}
        />
      ) : null}

      <ProfileNextAchievement achievement={closestLockedAchievement} />

      <ProfileFaithMessage message={faithMessage} />

      <ProfileChallengesSection enrollments={overview.enrollments} />

      <ProfileTimeline
        activeFilter={timelineFilter}
        challengeId={selectedChallengeId}
        initialHasMore={timelinePage.hasMore}
        initialItems={timelinePage.items}
        initialNextCursorAt={timelinePage.nextCursorAt}
        initialNextCursorId={timelinePage.nextCursorId}
        today={today}
        yesterday={yesterday}
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
