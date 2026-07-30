import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { TipRowActions } from "@/components/admin/tip-row-actions";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusCard } from "@/components/ui/feedback";
import { listAdminTips } from "@/server/services/admin-tips.service";

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
    description: "Envie uma imagem antes de publicar esta dica.",
  },
  "unpublish-success": { title: "Dica despublicada", description: "Ela voltou para rascunho." },
  "archive-success": { title: "Dica arquivada", description: "Ela não aparece mais para usuários." },
  "duplicate-success": { title: "Dica duplicada", description: "Uma cópia em rascunho foi criada." },
  "delete-success": { title: "Dica excluída", description: "O registro e a imagem foram removidos." },
};

type AdminDicasPageProps = {
  searchParams: Promise<{ feedback?: string }>;
};

export default async function AdminDicasPage({ searchParams }: AdminDicasPageProps) {
  const { feedback: feedbackKey } = await searchParams;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;
  const { data: rows, error } = await listAdminTips();
  const redirectTo = "/admin/dicas";

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
          Nova dica
        </Button>
      </div>

      {feedback ? (
        <StatusCard
          description={feedback.description}
          title={feedback.title}
          tone={feedbackKey === "error" || feedbackKey === "invalid" || feedbackKey === "publish-needs-image" ? "error" : "success"}
        />
      ) : null}

      {error ? (
        <StatusCard description={error} title="Não foi possível listar" tone="error" />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          description="Nenhuma dica cadastrada ainda. Crie a primeira para que ela apareça em /app/dicas assim que publicada."
          title="Nenhuma dica encontrada"
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-white/[0.08]">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-white/[0.035] text-xs uppercase tracking-[0.08em] text-muted-2">
              <tr>
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ordem</th>
                <th className="px-4 py-3 font-medium">Publicado em</th>
                <th className="px-4 py-3 font-medium">Desafio</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((tip) => (
                <tr key={tip.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-[0.6rem] border border-white/[0.08] bg-black">
                        {tip.media_url ? (
                          <Image alt="" className="object-contain" fill sizes="48px" src={tip.media_url} />
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
                    {tip.published_at ? new Date(tip.published_at).toLocaleDateString("pt-BR") : "—"}
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
    </div>
  );
}
