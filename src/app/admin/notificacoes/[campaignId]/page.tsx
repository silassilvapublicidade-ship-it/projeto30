import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { NotificationCampaignRowActions } from "@/components/admin/notification-campaign-row-actions";
import { StatusCard } from "@/components/ui/feedback";
import { NOTIFICATION_AUDIENCE_LABELS } from "@/features/admin/notification-campaigns.schemas";
import { NOTIFICATION_DESTINATION_LABELS } from "@/features/notifications/notification-destination.core";
import { getAdminNotificationCampaign } from "@/server/services/admin-notification-campaigns.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Detalhes da notificação · Administração",
};

// See src/app/admin/notificacoes/page.tsx for why this is needed here too -
// "Enviar agora" is also reachable from this page's own row actions menu.
export const maxDuration = 60;

const statusLabels: Record<string, string> = {
  cancelled: "Cancelada",
  draft: "Rascunho",
  failed: "Falhou",
  partially_failed: "Parcialmente falhada",
  processing: "Processando",
  scheduled: "Agendada",
  sent: "Enviada",
};

function MetricBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-2">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function formatRate(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return "—";
  }
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default async function NotificationCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await requireAdminUser();
  const { campaignId } = await params;
  const { data: campaign, error } = await getAdminNotificationCampaign(campaignId);

  if (error || !campaign) {
    notFound();
  }

  const redirectTo = `/admin/notificacoes/${campaignId}`;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link className="text-sm text-muted hover:text-foreground" href="/admin/notificacoes">
            ← Notificações
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{campaign.title}</h1>
          <p className="mt-1 text-sm leading-6 text-muted">{campaign.message}</p>
        </div>
        <NotificationCampaignRowActions
          campaignId={campaignId}
          campaignTitle={campaign.title}
          redirectTo={redirectTo}
          status={campaign.status}
          totalRecipients={campaign.audience_estimated_count ?? campaign.metrics.total_recipients}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-muted">
        <span className="rounded-full border border-white/[0.08] px-3 py-1">
          Status: {statusLabels[campaign.status] ?? campaign.status}
        </span>
        <span className="rounded-full border border-white/[0.08] px-3 py-1">
          Público: {NOTIFICATION_AUDIENCE_LABELS[campaign.audience_type] ?? campaign.audience_type}
        </span>
        <span className="rounded-full border border-white/[0.08] px-3 py-1">
          Destino: {NOTIFICATION_DESTINATION_LABELS[campaign.destination_type] ?? campaign.destination_type}
        </span>
        <span className="rounded-full border border-white/[0.08] px-3 py-1">
          Canais: {[campaign.channel_internal && "Interno", campaign.channel_push && "Push"].filter(Boolean).join(" + ")}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricBox label="Destinatários" value={campaign.metrics.total_recipients} />
        <MetricBox label="Enviadas" value={campaign.metrics.sent_count} />
        <MetricBox label="Abertas" value={campaign.metrics.opened_count} />
        <MetricBox label="Cliques" value={campaign.metrics.clicked_count} />
        <MetricBox label="Lidas" value={campaign.metrics.read_count} />
        <MetricBox label="Falhas" value={campaign.metrics.failed_count} />
        <MetricBox label="Canceladas" value={campaign.metrics.cancelled_count} />
        <MetricBox label="Pendentes/expiradas" value={campaign.metrics.pending_count} />
      </div>

      <div className="flex flex-wrap gap-4 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.03] p-4 text-sm">
        <p className="text-muted">
          Taxa de abertura:{" "}
          <strong className="text-foreground">
            {formatRate(campaign.metrics.opened_count, campaign.metrics.sent_count)}
          </strong>
        </p>
        <p className="text-muted">
          Taxa de clique:{" "}
          <strong className="text-foreground">
            {formatRate(campaign.metrics.clicked_count, campaign.metrics.sent_count)}
          </strong>
        </p>
        <p className="text-muted">
          Ignoradas (entregues, nunca abertas):{" "}
          <strong className="text-foreground">
            {Math.max(0, campaign.metrics.sent_count - campaign.metrics.opened_count).toLocaleString("pt-BR")}
          </strong>
        </p>
      </div>

      {campaign.failures.length > 0 ? (
        <div className="rounded-[var(--radius-card)] border border-danger/25 bg-danger-wash p-4">
          <p className="text-sm font-semibold text-danger">Falhas recentes</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {campaign.failures.map((failure, index) => (
              <li key={`${failure.user_id}-${index}`}>
                Usuário {failure.user_id.slice(0, 8)}… · {failure.failure_code ?? "erro desconhecido"} ·{" "}
                {failure.retry_count} tentativa(s)
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {campaign.status === "draft" ? (
        <StatusCard
          description="Esta campanha ainda não foi enviada. Edite, agende ou envie agora pelo menu de ações."
          title="Rascunho"
          tone="warning"
        />
      ) : null}
    </div>
  );
}
