import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ProfileEnrollmentSummary, ProfileOverview } from "@/server/services/profile-dashboard.service";

function MetricCard({ hint, label, value }: { hint?: string; label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/[0.08] bg-white/[0.03] p-3.5 sm:p-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">{label}</p>
      <p className="mt-1.5 font-display text-2xl leading-none text-foreground sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-[0.7rem] text-muted-2">{hint}</p> : null}
    </div>
  );
}

/**
 * Resumo principal (Parte 4) - alterna entre "Geral" (soma/máximo entre
 * todas as inscrições) e um desafio específico via ?desafio=<id> na própria
 * URL (mesmo padrão de /app/conquistas - nunca client state, sempre
 * navegável/compartilhável). O rótulo acima da grade sempre deixa explícito
 * qual escopo está sendo mostrado - nunca mistura os dois sem dizer qual é
 * qual.
 */
export function ProfileMetricsGrid({
  enrollments,
  selectedChallengeId,
  totals,
}: {
  enrollments: ProfileEnrollmentSummary[];
  selectedChallengeId: string | null;
  totals: ProfileOverview["totals"];
}) {
  const selected = selectedChallengeId
    ? enrollments.find((enrollment) => enrollment.challengeId === selectedChallengeId)
    : null;

  return (
    <section aria-labelledby="profile-metrics-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft" id="profile-metrics-heading">
          Resumo · {selected ? selected.challengeName : "Geral"}
        </h2>
        {enrollments.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar resumo por desafio">
            <Link
              className={cn(
                "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
                !selected
                  ? "border-action/32 bg-action/14 text-action-soft"
                  : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
              )}
              href="/app/dashboard"
            >
              Geral
            </Link>
            {enrollments.map((enrollment) => (
              <Link
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
                  selected?.enrollmentId === enrollment.enrollmentId
                    ? "border-action/32 bg-action/14 text-action-soft"
                    : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
                )}
                href={`/app/dashboard?desafio=${enrollment.challengeId}`}
                key={enrollment.enrollmentId}
              >
                {enrollment.challengeName}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            label="Dia atual"
            value={`${selected.currentDay}`}
            hint={`de ${selected.durationDays}`}
          />
          <MetricCard label="Sequência atual" value={`${selected.streakCurrent}`} hint="dias" />
          <MetricCard label="Melhor sequência" value={`${selected.streakBest}`} hint="dias" />
          <MetricCard label="Pontos" value={selected.pointsTotal.toLocaleString("pt-BR")} />
          <MetricCard label="Conquistas" value={`${selected.achievementsUnlocked}`} />
          <MetricCard label="Progresso do ciclo" value={`${Math.round(selected.completionPercent)}%`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Dias finalizados" value={`${totals.daysFinalized}`} />
          <MetricCard label="Sequência atual" value={`${totals.streakCurrentMax}`} hint="dias" />
          <MetricCard label="Melhor sequência" value={`${totals.streakBestMax}`} hint="dias" />
          <MetricCard label="Pontos totais" value={totals.pointsTotal.toLocaleString("pt-BR")} />
          <MetricCard label="Conquistas" value={`${totals.achievementsUnlocked}`} />
          <MetricCard label="Desafios concluídos" value={`${totals.challengesCompleted}`} />
        </div>
      )}
    </section>
  );
}
