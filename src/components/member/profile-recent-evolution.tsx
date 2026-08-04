import Link from "next/link";

import { cn } from "@/lib/utils";
import type { RecentEvolutionDay } from "@/server/services/profile-dashboard.service";

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(
    new Date(value),
  );
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC", weekday: "long" }).format(
    new Date(value),
  );
}

/**
 * "Evolução recente" (Parte 11) - barras simples via CSS, sem biblioteca de
 * gráficos. O período (7/30 dias) é escolhido pela própria URL
 * (?periodo=7|30), sem JS de cliente - mesmo padrão dos outros filtros
 * deste dashboard.
 */
export function ProfileRecentEvolution({
  days,
  period,
}: {
  days: RecentEvolutionDay[];
  period: 7 | 30;
}) {
  const finalizedCount = days.filter((day) => day.finalized).length;
  const averagePercent =
    days.length > 0 ? Math.round(days.reduce((total, day) => total + day.completionPercent, 0) / days.length) : 0;

  return (
    <section aria-labelledby="profile-recent-evolution-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft"
          id="profile-recent-evolution-heading"
        >
          Evolução recente
        </h2>
        <div className="flex gap-1.5" role="group" aria-label="Período da evolução recente">
          <Link
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
              period === 7
                ? "border-action/32 bg-action/14 text-action-soft"
                : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
            )}
            href="/app/perfil?periodo=7"
          >
            7 dias
          </Link>
          <Link
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
              period === 30
                ? "border-action/32 bg-action/14 text-action-soft"
                : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
            )}
            href="/app/perfil?periodo=30"
          >
            30 dias
          </Link>
        </div>
      </div>

      {days.length === 0 ? (
        <p className="rounded-[1.1rem] border border-dashed border-white/12 bg-white/[0.02] p-4 text-sm leading-6 text-muted">
          Seus próximos registros aparecerão aqui.
        </p>
      ) : (
        <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
          <div
            aria-label={`Percentual de conclusão dos últimos ${period} dias, em média ${averagePercent}%`}
            className="flex h-24 items-end gap-1"
            role="img"
          >
            {days.map((day) => (
              <span
                aria-label={`${formatFullDate(day.logDate)}: ${day.finalized ? `${Math.round(day.completionPercent)}% concluído` : "não finalizado"}`}
                className={cn(
                  "min-w-0 flex-1 rounded-t-sm transition-[height]",
                  day.finalized ? "bg-[linear-gradient(180deg,var(--p30-amber),var(--p30-orange))]" : "bg-white/[0.08]",
                )}
                key={day.logDate}
                style={{ height: `${Math.max(4, Math.round((day.completionPercent / 100) * 100))}%` }}
                title={`${formatFullDate(day.logDate)}: ${Math.round(day.completionPercent)}%`}
              />
            ))}
          </div>
          {period === 7 ? (
            <div className="mt-1.5 flex gap-1 font-mono text-[0.58rem] text-muted-2">
              {days.map((day) => (
                <span className="min-w-0 flex-1 text-center" key={day.logDate}>
                  {formatShortDate(day.logDate)}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 font-mono text-[0.68rem] text-muted-2">
            {finalizedCount} {finalizedCount === 1 ? "dia finalizado" : "dias finalizados"} · média de {averagePercent}%
          </p>
        </div>
      )}
    </section>
  );
}
