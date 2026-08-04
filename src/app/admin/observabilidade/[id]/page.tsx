import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { CopyDiagnosticButton } from "@/components/admin/copy-diagnostic-button";
import { APP_VERSION } from "@/config/system-version";
import {
  buildDiagnosticCopyText,
  SYSTEM_ERROR_AREA_LABELS,
  SYSTEM_ERROR_SEVERITY_LABELS,
  SYSTEM_ERROR_STATUS_LABELS,
  SYSTEM_ERROR_STATUSES,
} from "@/features/observability/system-error.core";
import { resolveSystemErrorEventAction } from "@/features/observability/observability-admin.actions";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { getSystemErrorEvent } from "@/server/services/system-observability.service";

export const metadata: Metadata = {
  title: "Ocorrência · Observabilidade · Administração",
};

const feedbackMessages: Record<string, { description: string; title: string; tone: "error" | "success" }> = {
  updated: { description: "O status da ocorrência foi atualizado.", title: "Ocorrência atualizada", tone: "success" },
  invalid: { description: "Revise os campos e tente novamente.", title: "Dados inválidos", tone: "error" },
  forbidden: {
    description: "Apenas super administradores podem alterar o status de uma ocorrência.",
    title: "Ação não permitida",
    tone: "error",
  },
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

type ObservabilityDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ObservabilityDetailPage({ params, searchParams }: ObservabilityDetailPageProps) {
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const admin = await requireAdminUser();
  const isSuperAdmin = admin.role === "super_admin";

  const event = await getSystemErrorEvent(id);

  if (!event) {
    notFound();
  }

  const feedbackKey = Array.isArray(rawSearchParams.feedback) ? rawSearchParams.feedback[0] : rawSearchParams.feedback;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;

  const diagnosticText = buildDiagnosticCopyText({
    appVersion: event.app_version,
    errorCode: event.error_code,
    messageSafe: event.message_safe,
    occurredAt: formatDateTime(event.last_seen_at),
    operation: event.operation,
    route: event.route,
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground focus-visible:outline-action-soft"
          href="/admin/observabilidade"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para Observabilidade
        </Link>
        <h1 className="mt-3 font-mono text-lg font-semibold text-foreground">{event.error_code}</h1>
        <p className="mt-1 text-sm leading-6 text-muted">{event.message_safe}</p>
      </div>

      {feedback ? <StatusCard description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{SYSTEM_ERROR_AREA_LABELS[event.area] ?? event.area}</Badge>
        <Badge tone="accent">{event.operation}</Badge>
        <Badge tone="warning">{SYSTEM_ERROR_SEVERITY_LABELS[event.severity]}</Badge>
        <Badge tone="neutral">{SYSTEM_ERROR_STATUS_LABELS[event.status]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 text-sm sm:grid-cols-3 sm:p-5">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Ocorrências</p>
          <p className="mt-1 text-foreground">{event.occurrence_count.toLocaleString("pt-BR")}</p>
        </div>
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Primeira vez</p>
          <p className="mt-1 text-foreground">{formatDateTime(event.first_seen_at)}</p>
        </div>
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Última vez</p>
          <p className="mt-1 text-foreground">{formatDateTime(event.last_seen_at)}</p>
        </div>
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Rota</p>
          <p className="mt-1 text-foreground">{event.route ?? "—"}</p>
        </div>
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Versão do sistema</p>
          <p className="mt-1 text-foreground">{event.app_version ?? "desconhecida"}</p>
        </div>
        {isSuperAdmin ? (
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Código Postgres</p>
            <p className="mt-1 text-foreground">{event.postgres_code ?? "—"}</p>
          </div>
        ) : null}
      </div>

      {isSuperAdmin ? (
        <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 text-sm sm:p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">
            Usuário afetado (visível apenas para super administradores)
          </p>
          {event.user_id ? (
            <Link
              className="mt-2 inline-flex text-foreground underline decoration-white/30 underline-offset-4 hover:text-action-soft"
              href={`/admin/usuarios/${event.user_id}`}
            >
              Abrir detalhe administrativo do usuário
            </Link>
          ) : (
            <p className="mt-2 text-muted">Nenhum usuário específico associado.</p>
          )}
          {Object.keys(event.metadata_safe).length > 0 ? (
            <pre className="mt-3 overflow-x-auto rounded-[var(--radius-control)] border border-white/[0.08] bg-black/30 p-3 text-xs text-muted">
              {JSON.stringify(event.metadata_safe, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : (
        <StatusCard
          description="Código Postgres, usuário afetado e metadata técnica ficam visíveis apenas para super administradores."
          title="Detalhe técnico restrito"
          tone="warning"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <CopyDiagnosticButton text={diagnosticText} />
      </div>

      {isSuperAdmin ? (
        <form
          action={resolveSystemErrorEventAction}
          className="space-y-4 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
        >
          <input name="id" type="hidden" value={event.id} />
          <h2 className="text-base font-semibold text-foreground">Investigar e resolver</h2>

          <label className="block space-y-2">
            <span className="block text-sm font-semibold text-foreground">Status</span>
            <select
              className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-64"
              defaultValue={event.status}
              name="status"
            >
              {SYSTEM_ERROR_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {SYSTEM_ERROR_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="block text-sm font-semibold text-foreground">Nota técnica (opcional)</span>
            <textarea
              className="min-h-24 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 py-3 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
              defaultValue={event.resolution_note ?? ""}
              maxLength={500}
              name="resolutionNote"
              placeholder="O que foi investigado, causa raiz, correção aplicada..."
            />
          </label>

          <label className="block space-y-2">
            <span className="block text-sm font-semibold text-foreground">Commit/versão da correção (opcional)</span>
            <input
              className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-64"
              defaultValue={event.resolved_in_version ?? ""}
              maxLength={60}
              name="resolvedInVersion"
              placeholder={APP_VERSION}
            />
          </label>

          <Button type="submit">Salvar</Button>
        </form>
      ) : null}
    </div>
  );
}
