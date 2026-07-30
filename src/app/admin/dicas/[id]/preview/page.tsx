import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { TipCard } from "@/components/member/tip-card";
import { StatusCard } from "@/components/ui/feedback";
import { getAdminTipById } from "@/server/services/admin-tips.service";

type PreviewDicaPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Preview da dica · Administração",
};

/**
 * Read-only, admin-only rendering of exactly the same TipCard component the
 * member gallery uses - "preview fiel ao que o usuário verá" is structural
 * (shared component), not a lookalike copy. Never records a view, never
 * reachable by a member, never touches analytics_events.
 */
export default async function PreviewDicaPage({ params }: PreviewDicaPageProps) {
  const { id } = await params;
  const { data: tip } = await getAdminTipById(id);

  if (!tip) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href={`/admin/dicas/${tip.id}/editar`}
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para edição
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Preview: {tip.title}</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Esta é uma prévia administrativa - nunca é exibida a usuários e não gera analytics.
        </p>
      </div>

      {!tip.media_url ? (
        <StatusCard
          description="Esta dica ainda não tem imagem enviada - ela não pode ser publicada até que uma imagem seja enviada."
          title="Sem imagem"
          tone="warning"
        />
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">
            Card na listagem (/app/dicas)
          </p>
          <div className="max-w-[320px]">
            <TipCard
              altText={tip.alt_text}
              category={tip.category}
              excerpt={tip.excerpt}
              imageUrl={tip.media_url}
              title={tip.title}
            />
          </div>
        </div>

        {tip.body ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">
              Tela de detalhe (/app/dicas/{tip.slug})
            </p>
            <div className="max-w-md space-y-3 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
              {tip.category ? (
                <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
                  {tip.category}
                </span>
              ) : null}
              <h2 className="font-display text-2xl text-foreground">{tip.title}</h2>
              {tip.excerpt ? <p className="text-sm leading-6 text-muted">{tip.excerpt}</p> : null}
              <p className="whitespace-pre-line text-sm leading-6 text-foreground/85">{tip.body}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
