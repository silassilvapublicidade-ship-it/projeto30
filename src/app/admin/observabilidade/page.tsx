import Link from "next/link";
import type { Metadata } from "next";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { CockpitBlockCard, type CockpitBlockStatus } from "@/components/admin/cockpit-block-card";
import { CopyDiagnosticButton } from "@/components/admin/copy-diagnostic-button";
import { ObservabilitySection } from "@/components/admin/observability-section";
import { ObservabilityStatusBanner } from "@/components/admin/observability-status-banner";
import { RetentionPurgePanel } from "@/components/admin/retention-purge-panel";
import { StatLine } from "@/components/admin/stat-line";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { APP_VERSION, getDeployInfo, LATEST_MIGRATION_ID, SERVICE_WORKER_VERSION } from "@/config/system-version";
import { describeCronEvidenceLabel, describeCronHealth } from "@/features/admin/cron-schedule.core";
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
import {
  getSystemHealthOverview,
  listSystemErrorEvents,
  previewSystemErrorPurge,
} from "@/server/services/system-observability.service";
import { getLatestStorageAuditRun } from "@/server/services/storage-audit.service";

export const metadata: Metadata = {
  title: "Central Operacional · Administração",
};

const PAGE_SIZE = 5;

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

const sectionBadgeTone: Record<CockpitBlockStatus, "success" | "accent" | "warning" | "danger"> = {
  saudavel: "success",
  atencao: "accent",
  degradado: "warning",
  critico: "danger",
};

const sectionBadgeLabel: Record<CockpitBlockStatus, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  degradado: "Degradado",
  critico: "Crítico",
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

  const [overview, { rows, totalCount }, purgePreview, latestStorageAuditRun] = await Promise.all([
    getSystemHealthOverview(),
    listSystemErrorEvents({ area, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, severity, status }),
    previewSystemErrorPurge(),
    getLatestStorageAuditRun().catch(() => null),
  ]);

  const purgeFeedback = firstParam(rawParams.purgeFeedback);
  const purgeDeletedParam = firstParam(rawParams.purgeDeleted);

  const alerts = buildHealthAlerts(overview);
  const [topAlert] = alerts;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const deployInfo = getDeployInfo();
  const cronHealth = describeCronHealth(overview);
  const cronEvidenceLabel = describeCronEvidenceLabel(overview);
  const hasAnyFiltersApplied = Boolean(area || severity || status);
  const hasEverHadErrors = totalCount > 0 || hasAnyFiltersApplied;

  const notificationsStatus: CockpitBlockStatus =
    overview.campaignsFailed24h > 0
      ? "critico"
      : overview.campaignsPartial24h > 0 || overview.deliveriesRetry >= 10
        ? "atencao"
        : "saudavel";

  const contentFailures = overview.cardsFailed24h + overview.uploadsFailed24h;
  const contentStatus: CockpitBlockStatus = contentFailures > 0 ? "atencao" : "saudavel";

  const usersStatus: CockpitBlockStatus = overview.onboardingStuck >= 5 ? "atencao" : "saudavel";

  const versionCopyText = [
    `Versão: ${APP_VERSION}`,
    `Ambiente: ${deployInfo.environment}`,
    `Commit: ${deployInfo.commitShaShort ?? "desconhecido"}`,
    `Service Worker: ${SERVICE_WORKER_VERSION}`,
    `Última migration: ${LATEST_MIGRATION_ID}`,
  ].join("\n");

  const updatedAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Central Operacional</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Saúde do sistema, alertas e diagnósticos em um só lugar.
          </p>
        </div>
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Atualizado às {updatedAt}</p>
      </div>

      <ObservabilityStatusBanner status={overview.status} />

      {purgeFeedback === "success" ? (
        <StatusCard
          description={`${purgeDeletedParam ?? "0"} diagnóstico(s) resolvido(s) removido(s) com sucesso.`}
          title="Limpeza concluída"
          tone="success"
        />
      ) : null}
      {purgeFeedback === "forbidden" ? (
        <StatusCard description="Apenas super administradores podem executar a limpeza." title="Ação não permitida" tone="warning" />
      ) : null}
      {purgeFeedback === "invalid" ? (
        <StatusCard description="A frase de confirmação não confere. Tente novamente." title="Confirmação inválida" tone="warning" />
      ) : null}
      {purgeFeedback === "error" ? (
        <StatusCard description="Não foi possível executar a limpeza agora." title="Falha na limpeza" tone="error" />
      ) : null}

      {topAlert ? (
        <div className={`min-w-0 rounded-[var(--radius-card)] border p-3 sm:p-4 ${alertToneClass[topAlert.tone]}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-foreground">{topAlert.title}</p>
              <p className="mt-1 break-words text-xs leading-5 text-muted sm:text-sm">{topAlert.description}</p>
              {alerts.length > 1 ? (
                <p className="mt-2 text-xs text-muted-2">+{alerts.length - 1} outro(s) ponto(s) nas seções abaixo.</p>
              ) : null}
            </div>
            {topAlert.href ? (
              <Link
                className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.08] focus-visible:outline-action-soft"
                href={topAlert.href}
              >
                Ver detalhes
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CockpitBlockCard
          ctaLabel="Ver erros"
          description={`${overview.errors24h} evento(s) nas últimas 24h · cron ${cronEvidenceLabel.toLowerCase()}`}
          headline={overview.openCriticalErrors24h > 0 ? `${overview.openCriticalErrors24h} erro(s) crítico(s)` : "Nenhum erro crítico"}
          href="#erros-recentes"
          status={overview.status}
          title="Sistema"
        />
        <CockpitBlockCard
          ctaLabel="Ver usuários"
          description={`${overview.usersAffected24h} usuário(s) afetado(s) por erros nas últimas 24h`}
          headline={overview.onboardingStuck > 0 ? `${overview.onboardingStuck} onboarding(s) pendente(s)` : "Nenhum onboarding pendente"}
          href="/admin/usuarios"
          status={usersStatus}
          title="Usuários"
        />
        <CockpitBlockCard
          ctaLabel="Ver notificações"
          description={`${overview.deliveriesRetry} deliveries em nova tentativa`}
          headline={overview.campaignsFailed24h > 0 ? `${overview.campaignsFailed24h} campanha(s) falharam` : "Nenhuma campanha falhou"}
          href="/admin/notificacoes"
          status={notificationsStatus}
          title="Notificações"
        />
        <CockpitBlockCard
          ctaLabel="Ver compartilhamentos"
          description={contentFailures > 0 ? "Veja Erros recentes para detalhes" : "Uploads e cards funcionando normalmente"}
          headline={contentFailures > 0 ? `${contentFailures} falha(s) de conteúdo` : "Nenhum upload ou card falhou"}
          href="/admin/compartilhamentos"
          status={contentStatus}
          title="Conteúdo"
        />
      </section>

      <div className="space-y-3">
        <ObservabilitySection
          badge={<Badge tone={sectionBadgeTone[notificationsStatus]}>{sectionBadgeLabel[notificationsStatus]}</Badge>}
          cta={
            <Button as="a" href="/admin/notificacoes" size="sm" variant="ghost">
              Ver notificações
            </Button>
          }
          defaultOpen={notificationsStatus !== "saudavel"}
          title="Notificações"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <StatLine
              text={overview.campaignsFailed24h > 0 ? `${overview.campaignsFailed24h} campanha(s) falharam` : "Nenhuma campanha falhou"}
              tone={overview.campaignsFailed24h > 0 ? "attention" : "positive"}
            />
            <StatLine
              text={overview.campaignsPartial24h > 0 ? `${overview.campaignsPartial24h} campanha(s) parcialmente falhas` : "Nenhuma campanha parcialmente falha"}
              tone={overview.campaignsPartial24h > 0 ? "attention" : "positive"}
            />
            <StatLine
              text={overview.deliveriesRetry > 0 ? `${overview.deliveriesRetry} entrega(s) aguardando nova tentativa` : "Nenhuma entrega aguardando nova tentativa"}
              tone={overview.deliveriesRetry >= 10 ? "attention" : "neutral"}
            />
            <StatLine text={`${overview.deliveriesPending} entrega(s) pendente(s)`} tone="neutral" />
            <StatLine
              text={overview.subscriptionsRevoked24h > 0 ? `${overview.subscriptionsRevoked24h} dispositivo(s) revogaram push nas últimas 24h` : "Nenhuma revogação de push nas últimas 24h"}
              tone={overview.subscriptionsRevoked24h >= 10 ? "attention" : "neutral"}
            />
            <StatLine text={`${overview.subscriptionsActive} subscription(s) de push ativa(s)`} tone="neutral" />
            <StatLine text={`Cron: ${cronEvidenceLabel}`} tone={cronHealth.status === "saudavel" ? "positive" : cronHealth.status === "critico" ? "attention" : "neutral"} />
          </div>
          <p className="text-xs leading-5 text-muted-2">
            {notificationsStatus === "saudavel"
              ? "Notificações funcionando normalmente."
              : "Revise os pontos destacados antes de ativar novas campanhas."}
          </p>
        </ObservabilitySection>

        <ObservabilitySection
          badge={<Badge tone={sectionBadgeTone[contentStatus]}>{sectionBadgeLabel[contentStatus]}</Badge>}
          cta={
            <Button as="a" href="/admin/compartilhamentos" size="sm" variant="ghost">
              Ver compartilhamentos
            </Button>
          }
          defaultOpen={contentStatus !== "saudavel"}
          title="Compartilhamentos e uploads"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <StatLine
              text={overview.cardsFailed24h > 0 ? `${overview.cardsFailed24h} card(s) com falha` : "Cards com falha: nenhum"}
              tone={overview.cardsFailed24h > 0 ? "attention" : "positive"}
            />
            <StatLine
              text={overview.uploadsFailed24h > 0 ? `${overview.uploadsFailed24h} upload(s) com falha` : "Uploads com falha: nenhum"}
              tone={overview.uploadsFailed24h > 0 ? "attention" : "positive"}
            />
            {latestStorageAuditRun ? (
              <StatLine
                text={`Storage: ${latestStorageAuditRun.orphanCount} órfão(s), ${latestStorageAuditRun.missingReferenceCount} referência(s) ausente(s) (auditoria ${formatDateTime(latestStorageAuditRun.startedAt)})`}
                tone={latestStorageAuditRun.missingReferenceCount > 0 || latestStorageAuditRun.orphanCount > 0 ? "attention" : "positive"}
              />
            ) : (
              <StatLine text="Storage: nenhuma auditoria executada ainda" tone="neutral" />
            )}
          </div>
          <div className="mt-1">
            <Button as="a" href="/admin/observabilidade/storage" size="sm" variant="ghost">
              Executar auditoria de Storage
            </Button>
          </div>
        </ObservabilitySection>

        <ObservabilitySection
          badge={
            purgePreview.eligibleCount > 0 ? (
              <Badge tone="accent">{purgePreview.eligibleCount} elegível(is)</Badge>
            ) : (
              <Badge tone="success">Em dia</Badge>
            )
          }
          title="Retenção de diagnósticos"
        >
          <RetentionPurgePanel isSuperAdmin={isSuperAdmin} preview={purgePreview} />
        </ObservabilitySection>

        <ObservabilitySection
          badge={<Badge tone={sectionBadgeTone[usersStatus]}>{sectionBadgeLabel[usersStatus]}</Badge>}
          cta={
            <Button as="a" href="/admin/usuarios?onboardingCompleted=false" size="sm" variant="ghost">
              Ver usuários
            </Button>
          }
          defaultOpen={usersStatus !== "saudavel"}
          title="Usuários e onboarding"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <StatLine
              text={overview.onboardingStuck > 0 ? `${overview.onboardingStuck} onboarding(s) pendente(s) há mais de 48h` : "Nenhum onboarding pendente"}
              tone={overview.onboardingStuck > 0 ? "attention" : "positive"}
            />
            <StatLine
              text={overview.usersAffected24h > 0 ? `${overview.usersAffected24h} usuário(s) afetado(s) por erros` : "Nenhum usuário afetado por erros"}
              tone={overview.usersAffected24h > 0 ? "attention" : "positive"}
            />
          </div>
        </ObservabilitySection>

        <ObservabilitySection
          badge={<CopyDiagnosticButton label="Copiar versão" text={versionCopyText} />}
          defaultOpen
          title="Versão e deploy"
        >
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Versão</dt>
              <dd className="mt-1 truncate text-foreground">{APP_VERSION}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Ambiente</dt>
              <dd className="mt-1 truncate text-foreground">{deployInfo.environment}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Commit</dt>
              <dd className="mt-1 truncate font-mono text-foreground">{deployInfo.commitShaShort ?? "desconhecido"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Service Worker</dt>
              <dd className="mt-1 truncate text-foreground">{SERVICE_WORKER_VERSION}</dd>
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Última migration</dt>
              <dd className="mt-1 truncate font-mono text-foreground">{LATEST_MIGRATION_ID}</dd>
            </div>
          </dl>
        </ObservabilitySection>
      </div>

      <section className="space-y-3" id="erros-recentes">
        <h2 className="text-base font-semibold text-foreground">Erros recentes</h2>

        {!hasEverHadErrors ? (
          <div className="rounded-[var(--radius-card)] border border-success/22 bg-success-wash p-4 text-sm text-success sm:p-5">
            Nenhum erro registrado nas últimas 24 horas.
          </div>
        ) : (
          <>
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
              <ul className="space-y-2">
                {rows.map((row) => (
                  <li
                    className="min-w-0 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4"
                    key={row.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        className="font-mono text-xs font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                        href={`/admin/observabilidade/${row.id}`}
                      >
                        {row.error_code}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={severityBadgeTone[row.severity]}>{SYSTEM_ERROR_SEVERITY_LABELS[row.severity]}</Badge>
                        <Badge tone={statusBadgeTone[row.status]}>{SYSTEM_ERROR_STATUS_LABELS[row.status]}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 break-words text-sm text-muted">{row.message_safe}</p>
                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.68rem] text-muted-2">
                      <span>{SYSTEM_ERROR_AREA_LABELS[row.area] ?? row.area}</span>
                      <span>{row.occurrence_count}× · última vez {formatDateTime(row.last_seen_at)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <AdminPagination basePath="/admin/observabilidade" page={Math.min(page, totalPages)} searchParams={rawParams} totalPages={totalPages} />
          </>
        )}
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
