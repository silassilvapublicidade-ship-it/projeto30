import type { Metadata } from "next";

import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { CockpitAlertList } from "@/components/admin/cockpit-alert-list";
import { CockpitBlockCard } from "@/components/admin/cockpit-block-card";
import { CockpitPeriodTabs } from "@/components/admin/cockpit-period-tabs";
import { CockpitRecentActivity } from "@/components/admin/cockpit-recent-activity";
import { CopyDiagnosticButton } from "@/components/admin/copy-diagnostic-button";
import { ObservabilityStatusBanner } from "@/components/admin/observability-status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { APP_VERSION, getDeployInfo, LATEST_MIGRATION_ID, SERVICE_WORKER_VERSION } from "@/config/system-version";
import { isCockpitPeriod, type CockpitPeriod } from "@/features/admin/admin-activity.core";
import { describeCronEvidenceLabel, describeCronHealth, getNextExpectedCronRun } from "@/features/admin/cron-schedule.core";
import { buildHealthAlerts, describeOperationalSummary } from "@/features/observability/health-alerts.core";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { requireAdminUser } from "@/server/services/admin-session.service";
import {
  getAdminOperationalOverview,
  getAdminRecentActivity,
} from "@/server/services/admin-operational-overview.service";

export const metadata: Metadata = {
  title: "Visão geral · Administração",
};

const cronStatusBadgeTone = {
  saudavel: "success",
  atencao: "warning",
  critico: "danger",
} as const;

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type AdminOverviewPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOverviewPage({ searchParams }: AdminOverviewPageProps) {
  const rawParams = await searchParams;
  const admin = await requireAdminUser();

  const periodParam = Array.isArray(rawParams.period) ? rawParams.period[0] : rawParams.period;
  const period: CockpitPeriod = periodParam && isCockpitPeriod(periodParam) ? periodParam : "today";

  let overview;
  let recentActivity: Awaited<ReturnType<typeof getAdminRecentActivity>> = [];

  try {
    [overview, recentActivity] = await Promise.all([
      getAdminOperationalOverview(period),
      getAdminRecentActivity(10),
    ]);
  } catch (error) {
    return (
      <StatusCard
        description={error instanceof Error ? error.message : "Não foi possível carregar o cockpit agora."}
        title="Cockpit indisponível"
        tone="error"
      />
    );
  }

  await recordAnalyticsEvent({ eventName: "admin_overview_viewed", source: "server" });

  const alerts = buildHealthAlerts(overview.health);
  const topAlerts = alerts.slice(0, 5);
  const summary = describeOperationalSummary(overview.health.status, alerts);
  const isSuperAdmin = admin.role === "super_admin";

  const deployInfo = getDeployInfo();
  const cronHealth = describeCronHealth(overview.health);
  const nextExpectedCronRun = getNextExpectedCronRun();

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const versionCopyText = [
    `Versão: ${APP_VERSION}`,
    `Ambiente: ${deployInfo.environment}`,
    `Commit: ${deployInfo.commitShaShort ?? "desconhecido"}`,
    `Service Worker: ${SERVICE_WORKER_VERSION}`,
    `Última migration: ${LATEST_MIGRATION_ID}`,
    `Status geral: ${overview.health.status}`,
  ].join("\n");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">{today}</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Cockpit operacional</h1>
          <p className="mt-1 text-sm leading-6 text-muted">{summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <CockpitPeriodTabs current={period} />
          <Button as="a" href="/admin/observabilidade" size="sm" variant="secondary">
            Ver diagnóstico
          </Button>
        </div>
      </div>

      <ObservabilityStatusBanner status={overview.health.status} />

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2">Métricas do período</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminMetricCard
            hint="daily_logs tocado no período (definição adotada, ver Parte C)"
            label="Usuários ativos"
            value={overview.metrics.activeUsers.toLocaleString("pt-BR")}
          />
          <AdminMetricCard label="Dias finalizados" value={overview.metrics.daysFinalized.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Novos cadastros" value={overview.metrics.newSignups.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Inscrições em desafios" value={overview.metrics.enrollments.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Campanhas enviadas" value={overview.metrics.campaignsSent.toLocaleString("pt-BR")} />
          <AdminMetricCard
            label="Notificações entregues"
            value={overview.metrics.notificationsDelivered.toLocaleString("pt-BR")}
          />
          <AdminMetricCard hint="Últimas 24h, fixo" label="Erros críticos" value={overview.metrics.criticalErrors.toLocaleString("pt-BR")} />
          <AdminMetricCard hint="Últimas 24h, fixo" label="Warnings" value={overview.metrics.warnings.toLocaleString("pt-BR")} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2">Precisa de atenção</h2>
        <CockpitAlertList alerts={topAlerts} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CockpitBlockCard
          ctaLabel="Ver diagnóstico"
          description={summary}
          headline={overview.health.status === "saudavel" ? "Tudo funcionando normalmente" : `${alerts.length} ponto(s) em aberto`}
          href="/admin/observabilidade"
          status={overview.health.status}
          title="Saúde do sistema"
        />
        <CockpitBlockCard
          ctaLabel="Ver usuários"
          description={`${overview.health.onboardingStuck} usuário(s) ainda não concluíram o onboarding há mais de 48h.`}
          headline={`${overview.metrics.newSignups} novo(s) cadastro(s) no período`}
          href="/admin/usuarios"
          title="Usuários"
        />
        <CockpitBlockCard
          ctaLabel="Ver desafios"
          description={
            overview.blocks.currentChallengeName
              ? `${overview.blocks.currentChallengeActiveParticipants} participante(s) ativo(s) em "${overview.blocks.currentChallengeName}".`
              : "Nenhum ciclo ativo no momento."
          }
          headline={`${overview.metrics.daysFinalized} dia(s) finalizado(s) no período`}
          href="/admin/desafios"
          title="Desafios"
        />
        <CockpitBlockCard
          ctaLabel="Ver notificações"
          description={`${overview.health.deliveriesRetry} deliveries em nova tentativa.`}
          headline={`${overview.metrics.campaignsSent} campanha(s) enviada(s) no período`}
          href="/admin/notificacoes"
          title="Notificações"
        />
        <CockpitBlockCard
          ctaLabel="Ver dicas"
          description={`${overview.blocks.cardsGenerated} card(s) de compartilhamento gerado(s) no período.`}
          headline={`${overview.blocks.tipsPublished} dica(s) publicada(s)`}
          href="/admin/dicas"
          title="Conteúdo"
        />
        <CockpitBlockCard
          ctaLabel="Ver diagnóstico"
          description={`Commit ${deployInfo.commitShaShort ?? "desconhecido"} · ${deployInfo.environment}`}
          headline={APP_VERSION}
          href="/admin/observabilidade"
          title="Deploy"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Automação e cron</h2>
            <Badge tone={cronStatusBadgeTone[cronHealth.status]}>{cronHealth.label}</Badge>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Última execução</dt>
              <dd className="mt-1 text-foreground">{describeCronEvidenceLabel(overview.health)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Duração</dt>
              <dd className="mt-1 text-foreground">
                {overview.health.lastCronRun?.metadata.durationMs
                  ? `${overview.health.lastCronRun.metadata.durationMs}ms`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Campanhas processadas</dt>
              <dd className="mt-1 text-foreground">{overview.health.lastCronRun?.metadata.campaignsProcessed ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Deliveries retentadas</dt>
              <dd className="mt-1 text-foreground">{overview.health.lastCronRun?.metadata.deliveriesRetried ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Próxima expectativa</dt>
              <dd className="mt-1 text-foreground">{formatDateTime(nextExpectedCronRun.toISOString())}</dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-muted-2">{overview.cronNote}</p>
        </div>

        <div className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Versão em produção</h2>
            <CopyDiagnosticButton label="Copiar versão" text={versionCopyText} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Versão</dt>
              <dd className="mt-1 text-foreground">{APP_VERSION}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Ambiente</dt>
              <dd className="mt-1 text-foreground">{deployInfo.environment}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Commit</dt>
              <dd className="mt-1 text-foreground">{deployInfo.commitShaShort ?? "desconhecido"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Service Worker</dt>
              <dd className="mt-1 text-foreground">{SERVICE_WORKER_VERSION}</dd>
            </div>
            <div className="col-span-2">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Última migration</dt>
              <dd className="mt-1 text-foreground">{LATEST_MIGRATION_ID}</dd>
            </div>
          </dl>
          <Button as="a" href="/admin/observabilidade" size="sm" variant="ghost">
            Ver diagnóstico
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2">Atividade recente</h2>
        <CockpitRecentActivity items={recentActivity} />
      </section>

      {!isSuperAdmin ? (
        <StatusCard
          description="Detalhes técnicos adicionais (código de diagnóstico, resolução de erros) ficam disponíveis em Observabilidade apenas para super administradores."
          title="Visão de administrador"
          tone="warning"
        />
      ) : null}
    </div>
  );
}
