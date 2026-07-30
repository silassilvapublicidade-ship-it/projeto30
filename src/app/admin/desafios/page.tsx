import Link from "next/link";
import type { Metadata } from "next";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { buildAdminQuery } from "@/components/admin/admin-query-utils";
import { AdminSortLink } from "@/components/admin/admin-sort-link";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import {
  archiveChallengeAction,
  publishChallengeAction,
  unpublishChallengeAction,
} from "@/features/admin/admin-challenges.actions";
import { duplicateChallengeAsDraftAction } from "@/features/admin/challenge-editor.actions";
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
};

type AdminChallengesPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminChallengesPage({
  searchParams,
}: AdminChallengesPageProps) {
  const rawParams = await searchParams;
  const params = parseChallengeListParams(rawParams);
  const { data, error } = await listAdminChallenges(params);
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
          tone={feedbackKey === "error" || feedbackKey === "invalid" ? "error" : "success"}
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
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="rounded-[var(--radius-pill)] border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.06]"
                          href={`/admin/desafios/${challenge.id}`}
                        >
                          Ver detalhe
                        </Link>
                        {challenge.status === "draft" ? (
                          <form action={publishChallengeAction}>
                            <input name="challengeId" type="hidden" value={challenge.id} />
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <Button size="sm" type="submit" variant="secondary">
                              Publicar
                            </Button>
                          </form>
                        ) : null}
                        {challenge.status === "active" ? (
                          <form action={unpublishChallengeAction}>
                            <input name="challengeId" type="hidden" value={challenge.id} />
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <Button size="sm" type="submit" variant="secondary">
                              Despublicar
                            </Button>
                          </form>
                        ) : null}
                        {["draft", "paused", "ended"].includes(challenge.status) ? (
                          <form action={archiveChallengeAction}>
                            <input name="challengeId" type="hidden" value={challenge.id} />
                            <input name="redirectTo" type="hidden" value={redirectTo} />
                            <ConfirmSubmitButton
                              confirmMessage="Arquivar este desafio? Ele deixa de aparecer como disponível para novos participantes."
                              size="sm"
                              variant="ghost"
                            >
                              Arquivar
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                        <form action={duplicateChallengeAsDraftAction}>
                          <input name="challengeId" type="hidden" value={challenge.id} />
                          <Button size="sm" type="submit" variant="ghost">
                            Duplicar
                          </Button>
                        </form>
                      </div>
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
