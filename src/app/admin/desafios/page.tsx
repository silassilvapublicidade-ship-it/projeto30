import Link from "next/link";
import type { Metadata } from "next";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { buildAdminQuery } from "@/components/admin/admin-query-utils";
import { AdminSortLink } from "@/components/admin/admin-sort-link";
import { ChallengeRowActions } from "@/components/admin/challenge-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import {
  getTotalPages,
  parseChallengeListParams,
} from "@/features/admin/admin-analytics.schemas";
import {
  describeChallengeStatus,
  formatChallengePeriod,
  formatCount,
  formatDate,
  formatPercent,
} from "@/features/admin/admin-metrics.core";
import { listAdminChallenges } from "@/server/services/admin-analytics.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

export const metadata: Metadata = {
  title: "Desafios · Administração",
};

const statusOptions = [
  { label: "Todos os status", value: "" },
  { label: "Rascunho", value: "draft" },
  { label: "Ativo", value: "active" },
  { label: "Pausado", value: "paused" },
  { label: "Encerrado", value: "ended" },
  { label: "Arquivado", value: "archived" },
];

const feedbackMessages: Record<string, { description: string; title: string }> = {
  "archive-success": { title: "Desafio arquivado", description: "O status foi atualizado." },
  error: {
    title: "Não foi possível concluir",
    description: "A transição de status falhou ou não é mais válida para este desafio.",
  },
  invalid: { title: "Solicitação inválida", description: "Identificador de desafio ausente." },
  "publish-success": { title: "Desafio publicado", description: "Ele agora está ativo." },
  "unpublish-success": {
    title: "Desafio despublicado",
    description: "Ele voltou para rascunho.",
  },
  "delete-success": {
    title: "Desafio excluído",
    description: "O desafio e sua configuração foram removidos definitivamente.",
  },
  "delete-blocked": {
    title: "Não é possível excluir",
    description:
      "Este desafio possui participantes ou histórico e não pode ser excluído. Utilize Arquivar.",
  },
  "purge-success": {
    title: "Desafio de teste excluído permanentemente",
    description: "O desafio e todo o seu histórico foram removidos.",
  },
  "purge-forbidden": {
    title: "Ação não permitida",
    description: "Apenas super_admin pode excluir permanentemente um desafio de teste.",
  },
  "purge-blocked": {
    title: "Não foi possível excluir permanentemente",
    description:
      "A confirmação não conferiu ou este desafio não está marcado como desafio de teste.",
  },
  "pause-success": {
    title: "Desafio pausado",
    description:
      "Novas inscrições e execução (marcar hábitos, finalizar dias) ficam bloqueadas até a retomada.",
  },
  "pause-blocked": {
    title: "Não foi possível pausar",
    description: "Apenas desafios ativos podem ser pausados.",
  },
  "resume-success": {
    title: "Desafio retomado",
    description: "Os dias em que ficou pausado foram creditados de volta para cada participante.",
  },
  "resume-blocked": {
    title: "Não foi possível retomar",
    description: "Apenas desafios pausados podem ser retomados.",
  },
  "end-success": {
    title: "Desafio encerrado",
    description: "O histórico continua preservado. Não é possível retomar por aqui.",
  },
  "end-blocked": {
    title: "Não foi possível encerrar",
    description: "Apenas desafios ativos ou pausados podem ser encerrados.",
  },
  "end-name-mismatch": {
    title: "Confirmação incorreta",
    description: "O nome digitado não confere com o nome do desafio.",
  },
};

type AdminChallengesPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminChallengesPage({
  searchParams,
}: AdminChallengesPageProps) {
  const rawParams = await searchParams;
  const params = parseChallengeListParams(rawParams);
  const [admin, { data, error }] = await Promise.all([
    requireAdminUser(),
    listAdminChallenges(params),
  ]);
  const isSuperAdmin = admin.role === "super_admin";
  const feedbackKey = Array.isArray(rawParams.feedback)
    ? rawParams.feedback[0]
    : rawParams.feedback;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const redirectTo = `/admin/desafios${buildAdminQuery(rawParams, { feedback: null })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Desafios</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Gestão dos ciclos configurados, com participantes e progresso médio reais.
          </p>
        </div>
        <Button as="a" href="/admin/desafios/novo">
          Novo desafio
        </Button>
      </div>

      {feedback ? (
        <StatusCard
          description={feedback.description}
          title={feedback.title}
          tone={
            feedbackKey === "error" ||
            feedbackKey === "invalid" ||
            feedbackKey === "delete-blocked" ||
            feedbackKey === "purge-forbidden" ||
            feedbackKey === "purge-blocked" ||
            feedbackKey === "pause-blocked" ||
            feedbackKey === "resume-blocked" ||
            feedbackKey === "end-blocked" ||
            feedbackKey === "end-name-mismatch"
              ? "error"
              : "success"
          }
        />
      ) : null}

      <form
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-center"
        method="get"
      >
        <Input
          aria-label="Buscar por nome ou slug"
          className="sm:max-w-xs"
          defaultValue={params.search ?? ""}
          name="search"
          placeholder="Buscar por nome ou slug"
          type="search"
        />
        <select
          aria-label="Filtrar por status"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-52"
          defaultValue={params.status ?? ""}
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
        <Button as="a" href="/admin/desafios" size="md" variant="ghost">
          Limpar
        </Button>
      </form>

      {error ? (
        <StatusCard description={error} title="Não foi possível listar" tone="error" />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          description="Nenhum desafio corresponde aos filtros atuais. Ajuste a busca ou o status selecionado."
          title="Nenhum desafio encontrado"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath="/admin/desafios"
                    currentSortBy={params.sortBy}
                    currentSortDir={params.sortDir}
                    label="Nome"
                    searchParams={rawParams}
                    sortKey="name"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath="/admin/desafios"
                    currentSortBy={params.sortBy}
                    currentSortDir={params.sortDir}
                    label="Participantes"
                    searchParams={rawParams}
                    sortKey="participant_count"
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath="/admin/desafios"
                    currentSortBy={params.sortBy}
                    currentSortDir={params.sortDir}
                    label="Progresso médio"
                    searchParams={rawParams}
                    sortKey="average_progress"
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath="/admin/desafios"
                    currentSortBy={params.sortBy}
                    currentSortDir={params.sortDir}
                    label="Criado em"
                    searchParams={rawParams}
                    sortKey="created_at"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.rows.map((challenge) => {
                return (
                  <tr key={challenge.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                        href={`/admin/desafios/${challenge.id}`}
                      >
                        {challenge.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-2">{challenge.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {describeChallengeStatus(challenge.status)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatChallengePeriod(challenge.start_date, challenge.end_date)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatCount(challenge.participant_count)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatPercent(challenge.average_progress)}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(challenge.created_at)}</td>
                    <td className="px-4 py-3">
                      <ChallengeRowActions
                        challengeId={challenge.id}
                        challengeName={challenge.name}
                        isSuperAdmin={isSuperAdmin}
                        isTest={challenge.is_test}
                        participantCount={challenge.participant_count}
                        redirectTo={redirectTo}
                        status={challenge.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data ? (
        <AdminPagination
          basePath="/admin/desafios"
          page={Math.min(params.page, getTotalPages(data.totalCount))}
          searchParams={rawParams}
          totalPages={getTotalPages(data.totalCount)}
        />
      ) : null}
    </div>
  );
}
