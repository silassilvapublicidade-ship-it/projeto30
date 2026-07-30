import Link from "next/link";
import type { Metadata } from "next";
import { Flag, Trophy } from "lucide-react";

import { ChallengeCard } from "@/components/member/challenge-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { describeEnrollmentStatus } from "@/features/admin/admin-metrics.core";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { getMemberChallengeCatalog } from "@/server/services/challenge-catalog.service";

export const metadata: Metadata = {
  title: "Desafios",
};

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

export default async function DesafiosPage() {
  await recordAnalyticsEvent({ eventName: "challenge_catalog_viewed" });

  const { activeEnrollments, catalog, history, localDate } = await getMemberChallengeCatalog();

  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <span className="flex size-12 items-center justify-center rounded-full bg-action/12 text-action-soft">
          <Flag aria-hidden="true" size={22} />
        </span>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] text-foreground sm:text-5xl">
          Desafios
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Você pode participar de vários desafios ao mesmo tempo. Escolha, continue ou revise o
          que já concluiu.
        </p>
      </section>

      {activeEnrollments.length > 0 ? (
        <section aria-labelledby="current-challenges" className="space-y-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="current-challenges"
          >
            {activeEnrollments.length > 1 ? "Meus desafios atuais" : "Meu desafio atual"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeEnrollments.map((enrollment) =>
              enrollment.challenge ? (
                <div
                  className="rounded-[1.75rem] border border-action/24 bg-[linear-gradient(180deg,rgba(255,106,0,0.1),rgba(255,255,255,0.02))] p-5 shadow-[var(--shadow-soft)] sm:p-6"
                  key={enrollment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-action-soft">
                        Dia {enrollment.current_day} de {enrollment.challenge.duration_days}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-foreground">
                        {enrollment.challenge.name}
                      </h3>
                    </div>
                    <Button as="a" href="/app/hoje">
                      Continuar desafio
                    </Button>
                  </div>
                  <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))]"
                      style={{
                        width: `${Math.min(100, Math.max(0, enrollment.completion_percent))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 font-mono text-[0.68rem] text-muted-2">
                    {Math.round(enrollment.completion_percent)}% concluído · sequência atual de{" "}
                    {enrollment.streak_current} dias
                  </p>
                </div>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section aria-labelledby="challenge-history" className="space-y-3">
          <h2
            className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="challenge-history"
          >
            <Trophy aria-hidden="true" size={13} />
            Histórico
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-white/[0.08]">
            <ul className="divide-y divide-white/[0.06]">
              {history.map((enrollment) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] px-4 py-3"
                  key={enrollment.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {enrollment.challenge?.name ?? "Desafio removido"}
                    </p>
                    <p className="text-xs text-muted-2">
                      {describeEnrollmentStatus(enrollment.status)} ·{" "}
                      {Math.round(enrollment.completion_percent)}% concluído
                      {enrollment.completed_at
                        ? ` · ${formatDate(enrollment.completed_at)}`
                        : ""}
                    </p>
                  </div>
                  {enrollment.challenge ? (
                    <Link
                      className="text-xs font-semibold text-action-soft hover:text-action"
                      href={`/app/desafios/${enrollment.challenge.slug}`}
                    >
                      Ver desafio
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="explore-challenges" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="explore-challenges"
        >
          Explorar
        </h2>
        {catalog.length === 0 ? (
          <EmptyState
            description="Ainda não há desafios publicados. Quando um novo ciclo abrir, ele aparece aqui."
            title="Nenhum desafio disponível"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((challenge) => (
              <ChallengeCard challenge={challenge} key={challenge.id} localDate={localDate} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
