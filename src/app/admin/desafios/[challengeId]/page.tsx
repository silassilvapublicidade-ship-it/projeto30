import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Users } from "lucide-react";

import { AdminBarList } from "@/components/admin/admin-bar-list";
import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { challengeIdSchema } from "@/features/admin/admin-analytics.schemas";
import {
  describeChallengeStatus,
  describeInstrumentationWindow,
  formatChallengePeriod,
  formatCount,
  formatDate,
  formatPercent,
  formatRetentionRate,
} from "@/features/admin/admin-metrics.core";
import {
  getAdminChallengeDetail,
  getAdminChallengeFunnel,
  getAdminChallengeRetention,
} from "@/server/services/admin-analytics.service";

export const metadata: Metadata = {
  title: "Detalhe do desafio · Administração",
};

type AdminChallengeDetailPageProps = {
  params: Promise<{ challengeId: string }>;
};

export default async function AdminChallengeDetailPage({
  params,
}: AdminChallengeDetailPageProps) {
  const { challengeId } = await params;
  const parsedId = challengeIdSchema.safeParse(challengeId);

  if (!parsedId.success) {
    notFound();
  }

  const [{ data, error }, { data: funnel }, { data: retention }] = await Promise.all([
    getAdminChallengeDetail(parsedId.data),
    getAdminChallengeFunnel(parsedId.data),
    getAdminChallengeRetention(parsedId.data),
  ]);

  if (error === "Registro não encontrado.") {
    notFound();
  }

  if (error || !data) {
    return (
      <StatusCard
        description={error ?? "Não foi possível carregar este desafio agora."}
        title="Analytics indisponíveis"
        tone="error"
      />
    );
  }

  const habitAdherence = data.habit_adherence;
  const mostCompleted = habitAdherence.slice(0, 3);
  const leastCompleted = [...habitAdherence].reverse().slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/desafios"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para desafios
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {data.challenge.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {describeChallengeStatus(data.challenge.status)} ·{" "}
              {formatChallengePeriod(data.challenge.start_date, data.challenge.end_date)} ·{" "}
              {data.challenge.duration_days} dias
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button as="a" href={`/admin/desafios/${data.challenge.id}/editar`} variant="secondary">
              Editar
            </Button>
            <Button
              as="a"
              href={`/admin/desafios/${data.challenge.id}/participantes`}
              leadingIcon={<Users aria-hidden="true" size={15} />}
            >
              Ver participantes
            </Button>
          </div>
        </div>
      </div>

      {funnel && funnel.stages.length > 0 ? (
        <section aria-labelledby="challenge-funnel" className="space-y-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="challenge-funnel"
          >
            Funil do desafio
          </h2>
          <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            <AdminBarList
              items={funnel.stages.map((stage) => ({
                label: stage.label,
                trailingLabel: formatCount(stage.value),
                value: stage.value,
              }))}
            />
          </div>
          <p className="font-mono text-[0.65rem] text-muted-2">
            {describeInstrumentationWindow(funnel.earliest_event_at)}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricCard
              hint="Contagem real de inscrições, não eventos"
              label="Inscrições reais"
              value={formatCount(funnel.joins_completed_real)}
            />
            <AdminMetricCard label="Concluíram (real)" value={formatCount(funnel.completed_real)} />
            <AdminMetricCard label="Abandonaram (real)" value={formatCount(funnel.abandoned_real)} />
            <AdminMetricCard label="Pausados agora" value={formatCount(funnel.currently_paused)} />
            <AdminMetricCard label="Dia 1 concluído" value={formatCount(funnel.day1_completed)} />
            <AdminMetricCard label="Dia 3 concluído" value={formatCount(funnel.day3_completed)} />
            <AdminMetricCard
              hint={`Dia ${funnel.halfway_day}`}
              label="Metade concluída"
              value={formatCount(funnel.halfway_completed_real)}
            />
            <AdminMetricCard
              hint="Pausas / retomadas registradas"
              label="Pausas · Retomadas"
              value={`${formatCount(funnel.pause_events)} · ${formatCount(funnel.resume_events)}`}
            />
          </div>
        </section>
      ) : null}

      {retention ? (
        <section aria-labelledby="challenge-retention" className="space-y-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="challenge-retention"
          >
            Retenção
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricCard
              hint={`${formatCount(retention.d1.retained)}/${formatCount(retention.d1.eligible)} elegíveis`}
              label="Retenção D1"
              value={formatRetentionRate(retention.d1.eligible, retention.d1.retained)}
            />
            <AdminMetricCard
              hint={`${formatCount(retention.d3.retained)}/${formatCount(retention.d3.eligible)} elegíveis`}
              label="Retenção D3"
              value={formatRetentionRate(retention.d3.eligible, retention.d3.retained)}
            />
            <AdminMetricCard
              hint={`${formatCount(retention.d7.retained)}/${formatCount(retention.d7.eligible)} elegíveis`}
              label="Retenção D7"
              value={formatRetentionRate(retention.d7.eligible, retention.d7.retained)}
            />
            <AdminMetricCard
              hint={`Dia ${retention.halfway.day} · ${formatCount(retention.halfway.retained)}/${formatCount(retention.halfway.eligible)} elegíveis`}
              label="Retenção na metade"
              value={formatRetentionRate(retention.halfway.eligible, retention.halfway.retained)}
            />
          </div>
          <p className="font-mono text-[0.65rem] text-muted-2">
            &quot;Elegíveis&quot; conta apenas inscrições cujo tempo de jornada já alcançou aquele
            dia (considerando pausas) - nunca inferido para quem ainda não chegou lá.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="challenge-kpis" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="challenge-kpis"
        >
          Indicadores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <AdminMetricCard label="Total inscritos" value={formatCount(data.total_enrolled)} />
          <AdminMetricCard
            hint={`Últimos ${data.active_window_days} dias`}
            label="Ativos"
            value={formatCount(data.active_participants)}
          />
          <AdminMetricCard label="Inativos" value={formatCount(data.inactive_participants)} />
          <AdminMetricCard label="Concluíram" value={formatCount(data.completed_participants)} />
          <AdminMetricCard
            label="Taxa de conclusão"
            value={formatPercent(data.completion_rate_percent)}
          />
          <AdminMetricCard
            label="Progresso médio"
            value={formatPercent(data.average_progress_percent)}
          />
          <AdminMetricCard label="Média de pontos" value={formatCount(data.average_points)} />
          <AdminMetricCard label="Média de sequência" value={formatCount(data.average_streak)} />
          <AdminMetricCard label="Maior sequência" value={formatCount(data.best_streak)} />
          <AdminMetricCard label="Dias finalizados" value={formatCount(data.finalized_days)} />
        </div>
      </section>

      <section aria-labelledby="enrollment-evolution" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="enrollment-evolution"
        >
          Evolução de inscrições (últimos 60 dias com registro)
        </h2>
        {data.enrollment_evolution.length === 0 ? (
          <EmptyState
            description="Ainda não há inscrições registradas para este desafio."
            title="Sem inscrições"
          />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            <AdminBarList
              items={data.enrollment_evolution.map((point) => ({
                label: formatDate(point.enrollment_day),
                trailingLabel: formatCount(point.enrollments),
                value: point.enrollments,
              }))}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="daily-completion" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="daily-completion"
        >
          Conclusão diária por dia do ciclo
        </h2>
        {data.daily_completion.length === 0 ? (
          <EmptyState
            description="Este desafio ainda não tem dias configurados."
            title="Sem dias configurados"
          />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            <AdminBarList
              items={data.daily_completion.map((day) => ({
                label: `Dia ${day.day_number}`,
                trailingLabel: `${formatCount(day.finalized_count)}/${formatCount(day.opened_count)}`,
                value: day.finalized_count,
              }))}
            />
          </div>
        )}
      </section>

      <section aria-labelledby="habit-adherence" className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="habit-adherence"
          >
            Hábitos mais concluídos
          </h2>
          <div className="mt-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            {mostCompleted.length === 0 ? (
              <p className="text-sm text-muted">Nenhum hábito configurado neste desafio.</p>
            ) : (
              <AdminBarList
                items={mostCompleted.map((habit) => ({
                  label: `${habit.title}${habit.required ? "" : " (opcional)"}`,
                  trailingLabel: formatPercent(habit.adherence_percent),
                  value: habit.adherence_percent,
                }))}
              />
            )}
          </div>
        </div>
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2">
            Hábitos menos concluídos
          </h2>
          <div className="mt-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            {leastCompleted.length === 0 ? (
              <p className="text-sm text-muted">Nenhum hábito configurado neste desafio.</p>
            ) : (
              <AdminBarList
                items={leastCompleted.map((habit) => ({
                  label: `${habit.title}${habit.required ? "" : " (opcional)"}`,
                  trailingLabel: formatPercent(habit.adherence_percent),
                  value: habit.adherence_percent,
                }))}
              />
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="progress-distribution" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="progress-distribution"
        >
          Distribuição de progresso dos participantes
        </h2>
        {data.progress_distribution.length === 0 ? (
          <EmptyState
            description="Ainda não há participantes inscritos para calcular a distribuição."
            title="Sem participantes"
          />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
            <AdminBarList
              items={data.progress_distribution.map((bucket) => ({
                label: bucket.bucket_label,
                trailingLabel: formatCount(bucket.participant_count),
                value: bucket.participant_count,
              }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}
