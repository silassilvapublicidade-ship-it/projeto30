import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { AdminSortLink } from "@/components/admin/admin-sort-link";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import {
  challengeIdSchema,
  getTotalPages,
  parseParticipantListParams,
} from "@/features/admin/admin-analytics.schemas";
import {
  describeActivity,
  describeEnrollmentStatus,
  formatCount,
  formatDate,
  formatPercent,
} from "@/features/admin/admin-metrics.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAdminParticipants } from "@/server/services/admin-analytics.service";

export const metadata: Metadata = {
  title: "Participantes · Administração",
};

const statusOptions = [
  { label: "Todos os status", value: "" },
  { label: "Ativo", value: "active" },
  { label: "Pausado", value: "paused" },
  { label: "Concluído", value: "completed" },
  { label: "Abandonado", value: "abandoned" },
  { label: "Reiniciado", value: "restarted" },
];

const activityOptions = [
  { label: "Qualquer atividade", value: "" },
  { label: "Ativo (recente)", value: "active" },
  { label: "Inativo", value: "inactive" },
  { label: "Concluiu", value: "completed" },
];

type AdminParticipantsPageProps = {
  params: Promise<{ challengeId: string }>;
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminParticipantsPage({
  params,
  searchParams,
}: AdminParticipantsPageProps) {
  const { challengeId } = await params;
  const parsedId = challengeIdSchema.safeParse(challengeId);

  if (!parsedId.success) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id,name,slug")
    .eq("id", parsedId.data)
    .is("deleted_at", null)
    .maybeSingle();

  if (!challenge) {
    notFound();
  }

  const rawParams = await searchParams;
  const filters = parseParticipantListParams(rawParams);
  const { data, error } = await listAdminParticipants(parsedId.data, filters);
  const basePath = `/admin/desafios/${parsedId.data}/participantes`;

  return (
    <div className="space-y-5">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href={`/admin/desafios/${parsedId.data}`}
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para o desafio
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          Participantes · {challenge.name}
        </h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Consulta paginada no servidor. Nenhuma lista completa é carregada de uma vez.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-5"
        method="get"
      >
        <Input
          aria-label="Buscar por nome ou e-mail"
          className="lg:col-span-2"
          defaultValue={filters.search ?? ""}
          name="search"
          placeholder="Buscar por nome ou e-mail"
          type="search"
        />
        <select
          aria-label="Filtrar por status"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
          defaultValue={filters.status ?? ""}
          name="status"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por atividade"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
          defaultValue={filters.activity ?? ""}
          name="activity"
        >
          {activityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Input
            aria-label="Progresso mínimo"
            defaultValue={filters.minProgress ?? ""}
            max={100}
            min={0}
            name="minProgress"
            placeholder="Prog. mín. %"
            type="number"
          />
          <Input
            aria-label="Progresso máximo"
            defaultValue={filters.maxProgress ?? ""}
            max={100}
            min={0}
            name="maxProgress"
            placeholder="Prog. máx. %"
            type="number"
          />
        </div>
        <div className="flex gap-2 lg:col-span-5">
          <Button size="md" type="submit">
            Filtrar
          </Button>
          <Button as="a" href={basePath} size="md" variant="ghost">
            Limpar
          </Button>
        </div>
      </form>

      {error ? (
        <StatusCard description={error} title="Não foi possível listar" tone="error" />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          description="Nenhum participante corresponde aos filtros atuais."
          title="Nenhum participante encontrado"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath={basePath}
                    currentSortBy={filters.sortBy}
                    currentSortDir={filters.sortDir}
                    label="Inscrição"
                    searchParams={rawParams}
                    sortKey="joined_at"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Dias concluídos</th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath={basePath}
                    currentSortBy={filters.sortBy}
                    currentSortDir={filters.sortDir}
                    label="Progresso"
                    searchParams={rawParams}
                    sortKey="completion_percent"
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath={basePath}
                    currentSortBy={filters.sortBy}
                    currentSortDir={filters.sortDir}
                    label="Pontos"
                    searchParams={rawParams}
                    sortKey="points_total"
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath={basePath}
                    currentSortBy={filters.sortBy}
                    currentSortDir={filters.sortDir}
                    label="Sequência"
                    searchParams={rawParams}
                    sortKey="streak_current"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Maior sequência</th>
                <th className="px-4 py-3 font-medium">
                  <AdminSortLink
                    basePath={basePath}
                    currentSortBy={filters.sortBy}
                    currentSortDir={filters.sortDir}
                    label="Última atividade"
                    searchParams={rawParams}
                    sortKey="last_activity_at"
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.rows.map((participant) => (
                <tr key={participant.enrollment_id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                      href={`${basePath}/${participant.enrollment_id}`}
                    >
                      {participant.name || "Sem nome"}
                    </Link>
                    <p className="text-xs text-muted-2">{participant.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(participant.joined_at)}</td>
                  <td className="px-4 py-3 text-muted">
                    {describeEnrollmentStatus(participant.status)}
                    <span className="ml-1.5 text-xs text-muted-2">
                      ({describeActivity(participant.activity)})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatCount(participant.finalized_days)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatPercent(participant.completion_percent)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatCount(participant.points_total)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatCount(participant.streak_current)}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatCount(participant.streak_best)}</td>
                  <td className="px-4 py-3 text-muted">
                    {participant.last_activity_at
                      ? formatDate(participant.last_activity_at)
                      : "Sem atividade"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data ? (
        <AdminPagination
          basePath={basePath}
          page={Math.min(filters.page, getTotalPages(data.totalCount))}
          searchParams={rawParams}
          totalPages={getTotalPages(data.totalCount)}
        />
      ) : null}
    </div>
  );
}
