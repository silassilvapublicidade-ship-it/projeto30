import type { Metadata } from "next";

import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { StatusCard } from "@/components/ui/feedback";
import {
  formatCount,
  formatPercent,
} from "@/features/admin/admin-metrics.core";
import {
  getAdminDashboardOverview,
  getAdminUsersAnalytics,
} from "@/server/services/admin-analytics.service";

export const metadata: Metadata = {
  title: "Visão geral · Administração",
};

export default async function AdminOverviewPage() {
  const [{ data, error }, { data: usersAnalytics }] = await Promise.all([
    getAdminDashboardOverview(),
    getAdminUsersAnalytics(),
  ]);

  if (error || !data) {
    return (
      <StatusCard
        description={error ?? "Não foi possível carregar a visão geral agora."}
        title="Métricas indisponíveis"
        tone="error"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
          Fase 2 · Analytics
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Visão geral</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Números vindos diretamente do banco. Participante ativo = inscrição ativa com
          registro nos últimos {data.active_window_days} dias.
        </p>
      </div>

      <section aria-labelledby="challenges-overview" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="challenges-overview"
        >
          Desafios
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard label="Total de desafios" value={formatCount(data.challenges_total)} />
          <AdminMetricCard label="Em rascunho" value={formatCount(data.challenges_draft)} />
          <AdminMetricCard label="Ativos" value={formatCount(data.challenges_active)} />
          <AdminMetricCard
            label="Encerrados / arquivados"
            value={formatCount(data.challenges_ended_or_archived)}
          />
        </div>
      </section>

      <section aria-labelledby="participants-overview" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="participants-overview"
        >
          Participantes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard
            label="Total de inscrições"
            value={formatCount(data.total_enrollments)}
          />
          <AdminMetricCard
            hint={`Ativos nos últimos ${data.active_window_days} dias`}
            label="Participantes ativos"
            value={formatCount(data.active_participants)}
          />
          <AdminMetricCard
            label="Concluíram ao menos 1 dia"
            value={formatCount(data.participants_completed_one_day)}
          />
          <AdminMetricCard
            label="Concluíram o desafio"
            value={formatCount(data.participants_completed_challenge)}
          />
        </div>
      </section>

      <section aria-labelledby="progress-overview" className="space-y-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
          id="progress-overview"
        >
          Progresso
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminMetricCard
            hint="Média de completion_percent de todas as inscrições"
            label="Progresso médio"
            value={formatPercent(data.average_progress_percent)}
          />
          <AdminMetricCard
            label="Dias finalizados no total"
            value={formatCount(data.total_finalized_days)}
          />
        </div>
      </section>

      {usersAnalytics ? (
        <section aria-labelledby="users-overview" className="space-y-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="users-overview"
          >
            Usuários
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricCard label="Total de usuários" value={formatCount(usersAnalytics.total)} />
            <AdminMetricCard label="Ativos" value={formatCount(usersAnalytics.active)} />
            <AdminMetricCard label="Suspensos" value={formatCount(usersAnalytics.suspended)} />
            <AdminMetricCard label="Inativos" value={formatCount(usersAnalytics.inactive_status)} />
            <AdminMetricCard
              label="Onboarding incompleto"
              value={formatCount(usersAnalytics.onboarding_incomplete)}
            />
            <AdminMetricCard
              label="Troca de senha pendente"
              value={formatCount(usersAnalytics.must_change_password_pending)}
            />
            <AdminMetricCard
              label="Com desafio ativo"
              value={formatCount(usersAnalytics.with_active_challenge)}
            />
            <AdminMetricCard
              label="Sem desafio ativo"
              value={formatCount(usersAnalytics.without_active_challenge)}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
