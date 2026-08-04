import Link from "next/link";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import type { ProfileEnrollmentSummary, ProfileOverview } from "@/server/services/profile-dashboard.service";

function MetricCard({
  hint,
  label,
  storageKey,
  suffix,
  value,
}: {
  hint?: string | undefined;
  label: string;
  storageKey: string;
  suffix?: string | undefined;
  value: number;
}) {
  return (
    <div className="rounded-[1.1rem] border border-white/[0.08] bg-white/[0.03] p-3.5 transition-[border-color] duration-[var(--motion-hover)] sm:p-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">{label}</p>
      <p className="mt-1.5 font-display text-2xl leading-none text-foreground sm:text-3xl">
        <AnimatedNumber storageKey={storageKey} value={value} />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </p>
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
  achievementsTotal,
  enrollments,
  pointsContextHint,
  selectedChallengeId,
  totals,
}: {
  achievementsTotal: number | null;
  enrollments: ProfileEnrollmentSummary[];
  pointsContextHint: string | null;
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
            hint={`de ${selected.durationDays}`}
            label="Dia atual"
            storageKey={`day:${selected.enrollmentId}`}
            value={selected.currentDay}
          />
          <MetricCard
            hint="dias"
            label="Sequência atual"
            storageKey={`streak-current:${selected.enrollmentId}`}
            value={selected.streakCurrent}
          />
          <MetricCard
            hint="dias"
            label="Melhor sequência"
            storageKey={`streak-best:${selected.enrollmentId}`}
            value={selected.streakBest}
          />
          <MetricCard label="Pontos" storageKey={`points:${selected.enrollmentId}`} value={selected.pointsTotal} />
          <MetricCard
            label="Conquistas"
            storageKey={`achievements:${selected.enrollmentId}`}
            value={selected.achievementsUnlocked}
          />
          <MetricCard
            label="Progresso do ciclo"
            storageKey={`completion:${selected.enrollmentId}`}
            suffix="%"
            value={Math.round(selected.completionPercent)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard
            hint={
              // "3 de 31 dias" so faz sentido sem ambiguidade quando ha
              // exatamente 1 desafio - com varios, cada um pode ter uma
              // duracao diferente, e o total agregado nao tem um
              // denominador unico honesto.
              enrollments.length === 1 ? `de ${enrollments[0]!.durationDays} dias` : undefined
            }
            label="Dias finalizados"
            storageKey="days-finalized"
            value={totals.daysFinalized}
          />
          <MetricCard
            hint="dias"
            label="Sequência atual"
            storageKey="streak-current-max"
            value={totals.streakCurrentMax}
          />
          <MetricCard
            hint="dias"
            label="Melhor sequência"
            storageKey="streak-best-max"
            value={totals.streakBestMax}
          />
          <MetricCard
            hint={
              // So mistura "+N hoje/nesta semana" (sempre de UM desafio
              // especifico) com o total agregado quando ha no maximo 1
              // inscricao - evita ambiguidade de "de qual desafio" quando
              // ha varias.
              enrollments.length <= 1 && pointsContextHint ? pointsContextHint : undefined
            }
            label="Pontos totais"
            storageKey="points-total"
            value={totals.pointsTotal}
          />
          <MetricCard
            hint={achievementsTotal !== null ? `de ${achievementsTotal}` : undefined}
            label="Conquistas"
            storageKey="achievements-total"
            value={totals.achievementsUnlocked}
          />
          <MetricCard
            hint={totals.challengesActive > 0 ? `${totals.challengesActive} em andamento` : undefined}
            label="Desafios concluídos"
            storageKey="challenges-completed"
            value={totals.challengesCompleted}
          />
        </div>
      )}
    </section>
  );
}
