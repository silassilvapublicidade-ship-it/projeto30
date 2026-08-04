import { Flame, ListChecks, Sparkles, Star } from "lucide-react";

import { DashboardMissionCtaLink } from "@/components/member/dashboard-mission-cta-link";
import { ProgressShareButton } from "@/components/member/progress-share-button";
import type { MissionCta, MissionStateKind } from "@/features/dashboard/dashboard-mission.core";

export type MissionCardData = {
  applicableHabits: number;
  challengeId: string;
  challengeName: string;
  completedHabits: number;
  countdownMessage: string | null;
  cta: MissionCta;
  currentDay: number;
  durationDays: number;
  enrollmentId: string;
  motivationalMessage: string | null;
  pointsEarnedToday: number;
  stateKind: MissionStateKind;
  streakBest: number;
  streakCurrent: number;
  title: string;
  todayDailyLogId: string | null;
};

const FINALIZED_STATE_KINDS: readonly MissionStateKind[] = [
  "day_finalized_partial",
  "day_finalized_streak_maintained",
];

function MissionCard({ data, featured }: { data: MissionCardData; featured: boolean }) {
  const remainingHabits = Math.max(0, data.applicableHabits - data.completedHabits);

  return (
    <article
      className={
        featured
          ? "rounded-[1.75rem] border border-action/28 bg-[linear-gradient(165deg,rgba(255,106,0,0.14),rgba(255,255,255,0.02)_60%)] p-5 shadow-[0_20px_60px_rgba(255,106,0,0.08)] sm:p-7"
          : "rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-action-soft">
          {data.challengeName}
        </p>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted-2">
          Dia {data.currentDay} de {data.durationDays}
        </span>
      </div>

      <h2
        className={
          featured
            ? "mt-4 font-display text-2xl leading-[1.15] text-foreground sm:text-3xl"
            : "mt-3 font-display text-xl leading-[1.15] text-foreground"
        }
      >
        {data.title}
      </h2>

      {data.countdownMessage ? (
        <p className="mt-2 text-sm text-muted-2">{data.countdownMessage}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[0.72rem] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <ListChecks aria-hidden="true" className="text-action-soft" size={14} />
          {data.completedHabits} {data.completedHabits === 1 ? "hábito realizado" : "hábitos realizados"}
        </span>
        {remainingHabits > 0 ? (
          <span>
            {remainingHabits} {remainingHabits === 1 ? "ainda disponível" : "ainda disponíveis"}
          </span>
        ) : null}
        {data.pointsEarnedToday > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Star aria-hidden="true" className="text-action-soft" size={14} />
            {data.pointsEarnedToday} {data.pointsEarnedToday === 1 ? "ponto hoje" : "pontos hoje"}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <Flame aria-hidden="true" className="text-action-soft" size={14} />
          {data.streakCurrent}d sequência · recorde {data.streakBest}d
        </span>
      </div>

      {data.motivationalMessage ? (
        <p className="mt-4 flex items-start gap-2 text-sm italic leading-6 text-muted">
          <Sparkles aria-hidden="true" className="mt-0.5 shrink-0 text-action-soft" size={14} />
          {data.motivationalMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {data.cta ? <DashboardMissionCtaLink href={data.cta.href}>{data.cta.label}</DashboardMissionCtaLink> : null}
        {FINALIZED_STATE_KINDS.includes(data.stateKind) && data.todayDailyLogId ? (
          <ProgressShareButton dailyLogId={data.todayDailyLogId} kind="day_completed" label={data.title} />
        ) : null}
      </div>
    </article>
  );
}

/**
 * "Sua missão de hoje" (Dashboard como alma do app, Parte A) - a primeira
 * dobra do Dashboard, respondendo "o que eu preciso fazer agora?". Um card
 * por desafio ativo/pausado (nunca soma hábitos/pontos entre desafios
 * diferentes - cada MissionCardData já vem pronto e isolado por
 * inscrição); o primeiro (pela mesma ordem de prioridade já usada em
 * outros pontos do dashboard - ativo > pausado, mais recente) recebe
 * destaque visual maior. Nunca mostra um checklist completo - só o resumo
 * objetivo pedido (hábitos feitos/disponíveis/pontos).
 */
export function DashboardMissionBlock({ cards }: { cards: MissionCardData[] }) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="dashboard-mission-heading" className="space-y-3">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft" id="dashboard-mission-heading">
        Sua missão de hoje
      </h2>
      <div className="space-y-3">
        {cards.map((card, index) => (
          <MissionCard data={card} featured={index === 0} key={card.enrollmentId} />
        ))}
      </div>
    </section>
  );
}
