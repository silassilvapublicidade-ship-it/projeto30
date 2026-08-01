import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { AdminBarList } from "@/components/admin/admin-bar-list";
import { AdminMetricCard } from "@/components/admin/admin-metric-card";
import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { TipRowActions } from "@/components/admin/tip-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { TIP_CATEGORIES } from "@/features/admin/admin-tips.schemas";
import { getTotalPages } from "@/features/admin/admin-analytics.schemas";
import { describeInstrumentationWindow, formatCount } from "@/features/admin/admin-metrics.core";
import { getAdminTipsAnalytics } from "@/server/services/admin-analytics.service";
import {
  ADMIN_TIP_PAGE_SIZE,
  listAdminTips,
  type AdminTipListParams,
} from "@/server/services/admin-tips.service";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Dicas · Administração",
};

const statusLabels: Record<string, string> = {
  archived: "Arquivado",
  draft: "Rascunho",
  published: "Publicado",
};

const feedbackMessages: Record<string, { description: string; title: string }> = {
  invalid: { title: "Solicitação inválida", description: "Identificador de dica ausente." },
  error: { title: "Não foi possível concluir", description: "A ação falhou. Tente novamente." },
  "publish-success": { title: "Dica publicada", description: "Ela agora aparece em /app/dicas." },
  "publish-needs-image": {
    title: "Não é possível publicar",
    description: "Uma dica precisa de imagem, título e categoria antes de ser publicada.",
  },
  "unpublish-success": { title: "Dica despublicada", description: "Ela voltou para rascunho." },
  "archive-success": { title: "Dica arquivada", description: "Ela não aparece mais para usuários." },
  "duplicate-success": { title: "Dica duplicada", description: "Uma cópia em rascunho foi criada." },
  "delete-success": { title: "Dica excluída", description: "O registro e a imagem foram removidos." },
};

type AdminDicasPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminDicasPage({ searchParams }: AdminDicasPageProps) {
  const rawParams = await searchParams;
  const q = firstValue(rawParams.q);
  const categoria = firstValue(rawParams.categoria);
  const status = firstValue(rawParams.status);
  const ordenar = firstValue(rawParams.ordenar);
  const feedbackKey = firstValue(rawParams.feedback);
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const page = Math.max(Number.parseInt(firstValue(rawParams.pagina) ?? "1", 10) || 1, 1);

  const params: AdminTipListParams = {
    category: categoria,
    page,
    search: q,
    sortBy: ordenar === "published_at" || ordenar === "created_at" ? ordenar : "display_order",
    status: status === "draft" || status === "published" || status === "archived" ? status : undefined,
  };

  const [{ data, error }, { data: analytics }] = await Promise.all([
    listAdminTips(params),
    getAdminTipsAnalytics(),
  ]);
  const redirectTo = `/admin/dicas${
    (() => {
      const query = new URLSearchParams();
      if (q) query.set("q", q);
      if (categoria) query.set("categoria", categoria);
      if (status) query.set("status", status);
      if (ordenar) query.set("ordenar", ordenar);
      if (page > 1) query.set("pagina", String(page));
      const built = query.toString();
      return built ? `?${built}` : "";
    })()
  }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dicas</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Cards visuais exibidos para os usuários em /app/dicas.
          </p>
        </div>
        <Button as="a" href="/admin/dicas/nova">
          Novo card de dica
        </Button>
      </div>

      {feedback ? (
        <StatusCard
          description={feedback.description}
          title={feedback.title}
          tone={
            feedbackKey === "error" || feedbackKey === "invalid" || feedbackKey === "publish-needs-image"
              ? "error"
              : "success"
          }
        />
      ) : null}

      {analytics ? (
        <section aria-labelledby="tips-analytics" className="space-y-3">
          <h2
            className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2"
            id="tips-analytics"
          >
            Analytics de dicas
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <AdminMetricCard label="Visualizações" value={formatCount(analytics.total_views)} />
            <AdminMetricCard label="Aberturas" value={formatCount(analytics.total_opens)} />
            <AdminMetricCard label="Downloads" value={formatCount(analytics.total_downloads)} />
          </div>
          <p className="font-mono text-[0.65rem] text-muted-2">
            {describeInstrumentationWindow(analytics.earliest_event_at)}
          </p>
          {analytics.cards.length > 0 ? (
            <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
              <AdminBarList
                items={analytics.cards.slice(0, 8).map((card) => ({
                  label: card.title,
                  trailingLabel: formatCount(card.views),
                  value: card.views,
                }))}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <form
        className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:flex-wrap sm:items-center"
        method="get"
      >
        <Input
          aria-label="Buscar por título"
          className="sm:max-w-xs"
          defaultValue={q ?? ""}
          name="q"
          placeholder="Buscar por título"
          type="search"
        />
        <select
          aria-label="Filtrar por categoria"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-52"
          defaultValue={categoria ?? ""}
          name="categoria"
        >
          <option value="">Todas as categorias</option>
          {TIP_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-44"
          defaultValue={status ?? ""}
          name="status"
        >
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="published">Publicado</option>
          <option value="archived">Arquivado</option>
        </select>
        <select
          aria-label="Ordenar por"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-56"
          defaultValue={ordenar ?? "display_order"}
          name="ordenar"
        >
          <option value="display_order">Ordem de exibição</option>
          <option value="published_at">Publicação mais recente</option>
          <option value="created_at">Criação mais recente</option>
        </select>
        <Button size="md" type="submit">
          Filtrar
        </Button>
        <Button as="a" href="/admin/dicas" size="md" variant="ghost">
          Limpar
        </Button>
      </form>

      {error ? (
        <StatusCard description={error} title="Não foi possível listar" tone="error" />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          description="Nenhuma dica corresponde aos filtros atuais, ou nenhuma foi criada ainda. Clique em “Novo card de dica” para criar a primeira."
          title="Nenhuma dica encontrada"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ordem</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium">Publicado em</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Desafio</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {data.rows.map((tip) => (
                <tr key={tip.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-[0.6rem] border border-white/[0.08] bg-black">
                        {tip.image_url ? (
                          <Image alt="" className="object-contain" fill sizes="48px" src={tip.image_url} />
                        ) : null}
                      </span>
                      <div className="min-w-0">
                        <Link
                          className="font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                          href={`/admin/dicas/${tip.id}/editar`}
                        >
                          {tip.title}
                        </Link>
                        <p className="truncate font-mono text-xs text-muted-2">{tip.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{tip.category ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{statusLabels[tip.status] ?? tip.status}</td>
                  <td className="px-4 py-3 text-muted">{tip.display_order}</td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(tip.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {tip.published_at ? new Date(tip.published_at).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {tip.starts_at || tip.ends_at ? (
                      <>
                        {tip.starts_at ? new Date(tip.starts_at).toLocaleDateString("pt-BR") : "—"}
                        {" – "}
                        {tip.ends_at ? new Date(tip.ends_at).toLocaleDateString("pt-BR") : "—"}
                      </>
                    ) : (
                      "Sempre"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{tip.challenge_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <TipRowActions
                      redirectTo={redirectTo}
                      status={tip.status as "archived" | "draft" | "published"}
                      tipId={tip.id}
                      tipTitle={tip.title}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.totalCount > ADMIN_TIP_PAGE_SIZE ? (
        <AdminPagination
          basePath="/admin/dicas"
          page={Math.min(page, getTotalPages(data.totalCount, ADMIN_TIP_PAGE_SIZE))}
          searchParams={rawParams}
          totalPages={getTotalPages(data.totalCount, ADMIN_TIP_PAGE_SIZE)}
        />
      ) : null}
    </div>
  );
}
