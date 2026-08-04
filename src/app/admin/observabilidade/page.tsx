import Link from "next/link";
import type { Metadata } from "next";

import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { CopyDiagnosticButton } from "@/components/admin/copy-diagnostic-button";
import { ObservabilityStatusBanner } from "@/components/admin/observability-status-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { APP_VERSION, getDeployInfo, LATEST_MIGRATION_ID, SERVICE_WORKER_VERSION } from "@/config/system-version";
import { buildHealthAlerts } from "@/features/observability/health-alerts.core";
import {
  SYSTEM_ERROR_AREA_LABELS,
  SYSTEM_ERROR_AREAS,
  SYSTEM_ERROR_SEVERITIES,
  SYSTEM_ERROR_SEVERITY_LABELS,
  SYSTEM_ERROR_STATUS_LABELS,
  SYSTEM_ERROR_STATUSES,
  isSystemErrorArea,
  type SystemErrorArea,
  type SystemErrorSeverity,
  type SystemErrorStatus,
} from "@/features/observability/system-error.core";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { getSystemHealthOverview, listSystemErrorEvents } from "@/server/services/system-observability.service";

export const metadata: Metadata = {
  title: "Observabilidade · Administração",
};

const PAGE_SIZE = 20;

const severityBadgeTone: Record<SystemErrorSeverity, "accent" | "neutral" | "success" | "warning" | "danger"> = {
  info: "neutral",
  warning: "warning",
  error: "danger",
  critical: "danger",
};

const statusBadgeTone: Record<SystemErrorStatus, "accent" | "neutral" | "success" | "warning" | "danger"> = {
  open: "danger",
  investigating: "warning",
  resolved: "success",
};

const alertToneClass: Record<"critical" | "warning" | "info", string> = {
  critical: "border-danger/25 bg-danger-wash text-danger",
  warning: "border-warning/25 bg-warning-wash text-warning",
  info: "border-white/[0.08] bg-white/[0.035] text-muted",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type ObservabilityPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function ObservabilityPage({ searchParams }: ObservabilityPageProps) {
  const rawParams = await searchParams;
  const admin = await requireAdminUser();
  const isSuperAdmin = admin.role === "super_admin";

  const areaParam = firstParam(rawParams.area);
  const severityParam = firstParam(rawParams.severity);
  const statusParam = firstParam(rawParams.status);
  const pageParam = firstParam(rawParams.page);
  const page = Math.max(1, Number(pageParam) || 1);

  const area = areaParam && isSystemErrorArea(areaParam) ? (areaParam as SystemErrorArea) : undefined;
  const severity =
    severityParam && (SYSTEM_ERROR_SEVERITIES as readonly string[]).includes(severityParam)
      ? (severityParam as SystemErrorSeverity)
      : undefined;
  const status =
    statusParam && (SYSTEM_ERROR_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as SystemErrorStatus)
      : undefined;

  const [overview, { rows, totalCount }] = await Promise.all([
    getSystemHealthOverview(),
    listSystemErrorEvents({ area, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, severity, status }),
  ]);

  const alerts = buildHealthAlerts(overview);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const deployInfo = getDeployInfo();

  const versionCopyText = [
    `Versão: ${APP_VERSION}`,
    `Ambiente: ${deployInfo.environment}`,
    `Commit: ${deployInfo.commitShaShort ?? "desconhecido"}`,
    `Service Worker: ${SERVICE_WORKER_VERSION}`,
    `Última migration: ${LATEST_MIGRATION_ID}`,
  ].join("\n");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Observabilidade</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Painel técnico para identificar rapidamente falhas reais, sem precisar de terminal, Vercel ou
          Supabase Studio.
        </p>
      </div>

      <ObservabilityStatusBanner status={overview.status} />

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div className={`rounded-[var(--radius-card)] border p-3 sm:p-4 ${alertToneClass[alert.tone]}`} key={alert.title}>
              <p className="text-sm font-semibold text-foreground">{alert.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">{alert.description}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminMetricCard hint="Últimas 24h" label="Erros" value={overview.errors24h.toLocaleString("pt-BR")} />
        <AdminMetricCard hint="Últimos 7 dias" label="Erros" value={overview.errors7d.toLocaleString("pt-BR")} />
        <AdminMetricCard hint="Últimas 24h" label="Usuários afetados" value={overview.usersAffected24h.toLocaleString("pt-BR")} />
        <AdminMetricCard hint="Últimas 24h" label="Onboarding preso" value={overview.onboardingStuck.toLocaleString("pt-BR")} />
      </div>

      <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Saúde das notificações</h2>
          <Button as="a" href="/admin/notificacoes" size="sm" variant="ghost">
            Ver notificações
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <AdminMetricCard label="Campanhas falhas (24h)" value={overview.campaignsFailed24h.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Parcialmente falhas (24h)" value={overview.campaignsPartial24h.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Deliveries pendentes" value={overview.deliveriesPending.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Deliveries em retry" value={overview.deliveriesRetry.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Subscriptions revogadas (24h)" value={overview.subscriptionsRevoked24h.toLocaleString("pt-BR")} />
          <AdminMetricCard label="Subscriptions ativas" value={overview.subscriptionsActive.toLocaleString("pt-BR")} />
          <AdminMetricCard
            hint={overview.lastCronRun ? undefined : "Nunca executado"}
            label="Última execução do cron"
            value={formatDateTime(overview.lastCronRun?.lastSeenAt ?? null)}
          />
          <AdminMetricCard
            label="Cron: última rodada"
            value={
              overview.lastCronRun
                ? `${overview.lastCronRun.metadata.campaignsProcessed ?? 0} camp. · ${overview.lastCronRun.metadata.deliveriesRetried ?? 0} retries`
                : "—"
            }
          />
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground">Saúde dos cards</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <AdminMetricCard label="Falhas de geração (24h)" value={overview.cardsFailed24h.toLocaleString("pt-BR")} />
            <AdminMetricCard
              hint="Somente leitura"
              label="Auditoria de Storage"
              value="Ver Compartilhamentos"
            />
          </div>
          <Button as="a" className="mt-4" href="/admin/compartilhamentos" size="sm" variant="ghost">
            Ver compartilhamentos
          </Button>
        </section>

        <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <h2 className="text-base font-semibold text-foreground">Uploads e onboarding</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <AdminMetricCard label="Uploads falhos (24h)" value={overview.uploadsFailed24h.toLocaleString("pt-BR")} />
            <AdminMetricCard label="Onboarding preso (48h+)" value={overview.onboardingStuck.toLocaleString("pt-BR")} />
          </div>
          <Button as="a" className="mt-4" href="/admin/usuarios?onboardingCompleted=false" size="sm" variant="ghost">
            Ver usuários
          </Button>
        </section>
      </div>

      <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Versão e deploy</h2>
          <CopyDiagnosticButton label="Copiar informações da versão" text={versionCopyText} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
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
          <div>
            <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Última migration</dt>
            <dd className="mt-1 text-foreground">{LATEST_MIGRATION_ID}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Erros recentes</h2>

        <form
          className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:flex-wrap"
          method="get"
        >
          <select
            aria-label="Filtrar por área"
            className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-52"
            defaultValue={area ?? ""}
            name="area"
          >
            <option value="">Todas as áreas</option>
            {SYSTEM_ERROR_AREAS.map((value) => (
              <option key={value} value={value}>
                {SYSTEM_ERROR_AREA_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por severidade"
            className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-44"
            defaultValue={severity ?? ""}
            name="severity"
          >
            <option value="">Toda severidade</option>
            {SYSTEM_ERROR_SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {SYSTEM_ERROR_SEVERITY_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por status"
            className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-44"
            defaultValue={status ?? ""}
            name="status"
          >
            <option value="">Todo status</option>
            {SYSTEM_ERROR_STATUSES.map((value) => (
              <option key={value} value={value}>
                {SYSTEM_ERROR_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <Button size="md" type="submit">
            Filtrar
          </Button>
          <Button as="a" href="/admin/observabilidade" size="md" variant="ghost">
            Limpar
          </Button>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            description="Nenhuma ocorrência corresponde aos filtros atuais - bom sinal."
            title="Nenhum erro encontrado"
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
                <tr>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Área</th>
                  <th className="px-4 py-3 font-medium">Operação</th>
                  <th className="px-4 py-3 font-medium">Severidade</th>
                  <th className="px-4 py-3 font-medium">Ocorrências</th>
                  <th className="px-4 py-3 font-medium">Última vez</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-mono text-xs font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                        href={`/admin/observabilidade/${row.id}`}
                      >
                        {row.error_code}
                      </Link>
                      <p className="mt-1 max-w-xs truncate text-xs text-muted-2">{row.message_safe}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{SYSTEM_ERROR_AREA_LABELS[row.area] ?? row.area}</td>
                    <td className="px-4 py-3 text-muted">{row.operation}</td>
                    <td className="px-4 py-3">
                      <Badge tone={severityBadgeTone[row.severity]}>{SYSTEM_ERROR_SEVERITY_LABELS[row.severity]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.occurrence_count.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-muted">{formatDateTime(row.last_seen_at)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusBadgeTone[row.status]}>{SYSTEM_ERROR_STATUS_LABELS[row.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination basePath="/admin/observabilidade" page={Math.min(page, totalPages)} searchParams={rawParams} totalPages={totalPages} />
      </section>

      {!isSuperAdmin ? (
        <StatusCard
          description="Detalhes técnicos (código Postgres, usuário afetado, metadata) e ações de resolução ficam visíveis apenas para super administradores."
          title="Visão limitada"
          tone="warning"
        />
      ) : null}
    </div>
  );
}

