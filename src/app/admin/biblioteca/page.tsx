import Link from "next/link";
import type { Metadata } from "next";

import { AdminPagination } from "@/components/admin/admin-pagination";
import type { AdminSearchParams } from "@/components/admin/admin-query-utils";
import { LibraryRowActions } from "@/components/admin/library-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { getTotalPages } from "@/features/admin/admin-analytics.schemas";
import { formatProjectDate } from "@/lib/format-date";
import { isLibraryAiEnabled } from "@/lib/env/server";
import {
  LIBRARY_PILLARS,
  LIBRARY_PILLAR_LABELS,
  LIBRARY_STATUSES,
  LIBRARY_STATUS_LABELS,
} from "@/features/library/library.core";
import { adminListLibraryContents } from "@/server/services/admin-library.service";

const PAGE_SIZE = 20;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Biblioteca · Administração",
};

const feedbackMessages: Record<string, { description: string; title: string; tone: "success" | "error" }> = {
  invalid: { title: "Solicitação inválida", description: "Identificador de conteúdo ausente.", tone: "error" },
  "transition-error": {
    title: "Não foi possível mudar o status",
    description: "Revise se o conteúdo já foi aprovado antes de publicar ou agendar.",
    tone: "error",
  },
  "transition-success": { title: "Status atualizado", description: "O conteúdo foi atualizado.", tone: "success" },
  "review-success": { title: "Marcado como revisado", description: "Registro de revisão salvo.", tone: "success" },
  "create-success": { title: "Conteúdo criado", description: "Continue preenchendo os blocos editoriais.", tone: "success" },
  "ai-draft-success": { title: "Rascunho gerado por IA", description: "Revise o conteúdo antes de enviar para aprovação.", tone: "success" },
};

type AdminBibliotecaPageProps = {
  searchParams: Promise<AdminSearchParams>;
};

export default async function AdminBibliotecaPage({ searchParams }: AdminBibliotecaPageProps) {
  const rawParams = await searchParams;
  const q = firstValue(rawParams.q);
  const status = firstValue(rawParams.status);
  const pillar = firstValue(rawParams.pillar);
  const feedbackKey = firstValue(rawParams.feedback);
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const page = Math.max(Number.parseInt(firstValue(rawParams.page) ?? "1", 10) || 1, 1);

  const { rows, total } = await adminListLibraryContents({
    status,
    pillar,
    search: q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const redirectTo = `/admin/biblioteca${
    (() => {
      const query = new URLSearchParams();
      if (q) query.set("q", q);
      if (status) query.set("status", status);
      if (pillar) query.set("pillar", pillar);
      if (page > 1) query.set("page", String(page));
      const built = query.toString();
      return built ? `?${built}` : "";
    })()
  }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Biblioteca</h1>
          <p className="mt-1 text-sm leading-6 text-muted">
            Conteúdos de Corpo, Mente, Caráter e Espírito. Nada é publicado sem passar por revisão e aprovação.
          </p>
        </div>
        <div className="flex gap-2">
          {isLibraryAiEnabled() ? (
            <Button as="a" href="/admin/biblioteca/gerar" variant="secondary">
              Gerar com IA
            </Button>
          ) : null}
          <Button as="a" href="/admin/biblioteca/nova">
            Novo conteúdo
          </Button>
        </div>
      </div>

      {feedback ? <StatusCard description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

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
          aria-label="Filtrar por pilar"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-48"
          defaultValue={pillar ?? ""}
          name="pillar"
        >
          <option value="">Todos os pilares</option>
          {LIBRARY_PILLARS.map((value) => (
            <option key={value} value={value}>
              {LIBRARY_PILLAR_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por status"
          className="min-h-12 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none sm:w-48"
          defaultValue={status ?? ""}
          name="status"
        >
          <option value="">Todos os status</option>
          {LIBRARY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LIBRARY_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button size="md" type="submit">
          Filtrar
        </Button>
        <Button as="a" href="/admin/biblioteca" size="md" variant="ghost">
          Limpar
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          description="Nenhum conteúdo corresponde aos filtros atuais, ou nenhum foi criado ainda. Clique em “Novo conteúdo” para criar o primeiro."
          title="Nenhum conteúdo encontrado"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Pilar</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Origem</th>
                <th className="px-4 py-3 font-medium">Revisão reforçada</th>
                <th className="px-4 py-3 font-medium">Atualizado em</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold text-foreground hover:text-action-soft focus-visible:outline-action-soft"
                      href={`/admin/biblioteca/${row.id}/editar`}
                    >
                      {row.title}
                    </Link>
                    <p className="truncate font-mono text-xs text-muted-2">{row.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {LIBRARY_PILLAR_LABELS[row.pillar as keyof typeof LIBRARY_PILLAR_LABELS] ?? row.pillar}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {LIBRARY_STATUS_LABELS[row.status as keyof typeof LIBRARY_STATUS_LABELS] ?? row.status}
                  </td>
                  <td className="px-4 py-3 text-muted">{row.source_type === "ai_assisted" ? "IA (rascunho)" : "Manual"}</td>
                  <td className="px-4 py-3 text-muted">{row.requires_enhanced_review ? "Sim" : "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatProjectDate(row.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link
                        className="rounded-full px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
                        href={`/admin/biblioteca/${row.id}/preview`}
                      >
                        Preview
                      </Link>
                      <LibraryRowActions contentId={row.id} redirectTo={redirectTo} status={row.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <AdminPagination
          basePath="/admin/biblioteca"
          page={Math.min(page, getTotalPages(total, PAGE_SIZE))}
          searchParams={rawParams}
          totalPages={getTotalPages(total, PAGE_SIZE)}
        />
      ) : null}
    </div>
  );
}
