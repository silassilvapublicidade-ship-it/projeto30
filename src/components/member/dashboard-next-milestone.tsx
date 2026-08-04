"use client";

import { Target } from "lucide-react";

import { recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";
import type { NextMilestone } from "@/features/dashboard/dashboard-next-milestone.core";

/**
 * "Seu próximo marco" (Refinamento premium, Parte C item 11) - substitui o
 * antigo ProfileNextObjective: mesma posicao visual, mas agora com barra de
 * progresso e CTA proprios, alimentado por resolveNextMilestone (7
 * prioridades fixas). Nunca mostra mais de um marco por vez; quando nao ha
 * nenhum com dado real por tras (challenge ainda nao comecou), o
 * chamador simplesmente nao renderiza este componente.
 */
export function DashboardNextMilestone({
  challengeId,
  enrollmentId,
  ctaHref,
  milestone,
}: {
  challengeId?: string | null | undefined;
  enrollmentId?: string | null | undefined;
  ctaHref: string;
  milestone: NextMilestone;
}) {
  const progressPercent = milestone.progress !== null ? Math.round(Math.min(1, Math.max(0, milestone.progress)) * 100) : null;

  return (
    <div className="flex items-start gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-action-soft">
        <Target aria-hidden="true" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">Seu próximo marco</p>
        <p className="mt-1 text-sm font-medium leading-6 text-foreground">{milestone.title}</p>
        <p className="mt-0.5 text-sm leading-6 text-muted-1">{milestone.distance}</p>

        {progressPercent !== null && (
          <div
            aria-label={`${progressPercent}% do caminho para este marco`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressPercent}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-action transition-[width] duration-[var(--motion-progress)] ease-[var(--ease-premium)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        <a
          className="mt-3 inline-flex text-sm font-medium text-action-soft underline decoration-action/40 underline-offset-4 transition-colors duration-[var(--motion-fast)] hover:text-action"
          href={ctaHref}
          onClick={() => {
            void recordProfileDashboardEventAction("dashboard_next_goal_clicked", {
              ...(challengeId ? { challengeId } : {}),
              ...(enrollmentId ? { enrollmentId } : {}),
            });
          }}
        >
          {milestone.cta}
        </a>
      </div>
    </div>
  );
}
