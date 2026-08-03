import Link from "next/link";
import type { Metadata } from "next";

import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { buildAdminQuery } from "@/components/admin/admin-query-utils";
import { NotificationCampaignRowActions } from "@/components/admin/notification-campaign-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import {
  ADMIN_NOTIFICATION_CAMPAIGN_PAGE_SIZE,
  getNotificationCampaignPeriodSummary,
  listAdminNotificationCampaigns,
} from "@/server/services/admin-notification-campaigns.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Notificações · Administração",
};

// "Enviar agora" (startNotificationCampaignNowAction) runs the real batch
// dispatch synchronously inside the Server Action - Next.js applies
// maxDuration to Server Actions only via the invoking page, not the action
// file itself (see maxDuration.md). 60s is the Vercel Hobby-plan ceiling.
export const maxDuration = 60;

const statusOptions = [
  { label: "Todos os status", value: "" },
  { label: "Rascunho", value: "draft" },
  { label: "Agendada", value: "scheduled" },
  { label: "Processando", value: "processing" },
  { label: "Enviada", value: "sent" },
  { label: "Parcialmente falhada", value: "partially_failed" },
  { label: "Falhou", value: "failed" },
  { label: "Cancelada", value: "cancelled" },
];

const statusLabels: Record<string, string> = {
  cancelled: "Cancelada",
  draft: "Rascunho",
  failed: "Falhou",
  partially_failed: "Parcialmente falhada",
  processing: "Processando",
  scheduled: "Agendada",
  sent: "Enviada",
};

const feedbackMessages: Record<string, { description: string; title: string }> = {
  "create-success": { title: "Rascunho criado", description: "Revise e agende ou envie quando quiser." },
  "duplicate-success": { title: "Campanha duplicada", description: "Uma nova cópia em rascunho foi criada." },
  "schedule-success": { title: "Campanha agendada", description: "Será enviada automaticamente na data escolhida." },
  "schedule-blocked": { title: "Não foi possível agendar", description: "A data precisa ser no futuro." },
  "send-success": { title: "Envio iniciado", description: "A campanha está sendo entregue agora." },
  "send-blocked": {
    title: "Envio não confirmado",
    description: "A confirmação digitada não conferiu com a frase exigida.",
  },
  "cancel-success": { title: "Campanha cancelada", description: "Ela não será mais enviada." },
  "cancel-blocked": { title: "Não foi possível cancelar", description: "Esta campanha não pode mais ser cancelada." },
  "delete-success": { title: "Rascunho excluído", description: "A campanha foi removida." },
  "delete-blocked": { title: "Não foi possível excluir", description: "Apenas rascunhos podem ser excluídos." },
  invalid: { title: "Solicitação inválida", description: "Identificador de campanha ausente." },
  error: { title: "Não foi possível concluir", description: "Tente novamente em alguns segundos." },
};

function getTotalPages(totalCount: number) {
  return Math.max(1, Math.ceil(totalCount / ADMIN_NOTIFICATION_CAMPAIGN_PAGE_SIZE));
}

type AdminNotificationsPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminNotificationsPage({ searchParams }: AdminNotificationsPageProps) {
  const rawParams = await searchParams;
  await requireAdminUser();

  const search = Array.isArray(rawParams.search) ? rawParams.search[0] : rawParams.search;
  const status = Array.isArray(rawParams.status) ? rawParams.status[0] : rawParams.status;
  const pageParam = Array.isArray(rawParams.page) ? rawParams.page[0] : rawParams.page;
  const page = Math.max(1, Number(pageParam) || 1);

  const [{ data, error }, periodSummary] = await Promise.all([
    listAdminNotificationCampaigns({ page, search, status }),
    getNotificationCampaignPeriodSummary(30),
  ]);

  const feedbackKey = Array.isArray(rawParams.feedback) ? rawParams.feedback[0] : rawParams.feedback;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const redirectTo = `/admin/notificacoes${buildAdminQuery(rawParams, { feedback: null })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Notificações</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Campanhas personalizadas, agendamentos e automações da Central de Notificações.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as="a" href="/admin/notificacoes/motivacionais" variant="secondary">
            Mensagens motivacionais
          </Button>
          <Button as="a" href="/admin/notificacoes/nova">
            Nova notificação
          </Button>
        </div>
      </div>

      {feedback ? (
        <StatusCard
          description={feedback.description}
          title={feedback.title}
          tone={
            feedbackKey?.includes("blocked") || feedbackKey === "error" || feedbackKey === "invalid"
              ? "error"
              : "success"
          }
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminMetricCard hint="Últimos 30 dias" label="Campanhas enviadas" value={periodSummary.campaignsSent.toLocaleString("pt-BR")} />
        <AdminMetricCard hint="Últimos 30 dias" label="Notificações enviadas" value={periodSummary.notificationsSent.toLocaleString("pt-BR")} />
        <AdminMetricCard hint="Últimos 30 dias" label="Abertas" value={periodSummary.notificationsOpened.toLocaleString("pt-BR")} />
        <AdminMetricCard hint="Últimos 30 dias" label="Clicadas" value={periodSummary.notificationsClicked.toLocaleString("pt-BR")} />
      </div>

      <form
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-center"
        method="get"
      >
        <Input
          aria-label="Buscar por título ou mensagem"
          className="sm:max-w-xs"
          defaultValue={search ?? ""}
          name="search"
          placeholder="Buscar por título ou mensagem"
          type="search"
        />
        <select
          aria-label="Filtrar por status"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-56"
          defaultValue={status ?? ""}
          name="status"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button size="md" type="submit">
          Filtrar
        </Button>
        <Button as="a" href="/admin/notificacoes" size="md" variant="ghost">
          Limpar
        </Button>
      </form>

      {error ? (
        <StatusCard description={error} title="Não foi possível listar" tone="error" />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          description="Nenhuma campanha corresponde aos filtros atuais."
          title="Nenhuma notificação encontrada"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Destinatários</th>
                <th className="px-4 py-3 font-medium">Enviadas</th>
                <th className="px-4 py-3 font-medium">Abertas</th>
                <th className="px-4 py-3 font-medium">Falhas</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.rows.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                      href={`/admin/notificacoes/${campaign.id}`}
                    >
                      {campaign.title}
                    </Link>
                    <p className="text-xs text-muted-2">{campaign.created_by_name ?? "Automação"}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{statusLabels[campaign.status] ?? campaign.status}</td>
                  <td className="px-4 py-3 text-muted">{campaign.source === "admin" ? "Admin" : "Automação"}</td>
                  <td className="px-4 py-3 text-muted">{campaign.total_recipients.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-muted">{campaign.sent_count.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-muted">{campaign.opened_count.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-muted">{campaign.failed_count.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">
                    <NotificationCampaignRowActions
                      campaignId={campaign.id}
                      campaignTitle={campaign.title}
                      redirectTo={redirectTo}
                      status={campaign.status}
                      totalRecipients={campaign.audience_estimated_count ?? campaign.total_recipients}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data ? (
        <AdminPagination
          basePath="/admin/notificacoes"
          page={Math.min(page, getTotalPages(data.totalCount))}
          searchParams={rawParams}
          totalPages={getTotalPages(data.totalCount)}
        />
      ) : null}
    </div>
  );
}
