import Image from "next/image";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatReadingTime, LIBRARY_PILLAR_LABELS, type LibraryPillar } from "@/features/library/library.core";
import { updateLibraryProgressAction } from "@/features/library/library.actions";

export type LibraryContentViewData = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  introduction: string | null;
  body: string | null;
  practical_application: string | null;
  reflection_question: string | null;
  small_action: string | null;
  final_message: string | null;
  bible_reference: string | null;
  bible_excerpt: string | null;
  pillar: string;
  category: string | null;
  reading_time_minutes: number | null;
  cover_image_url: string | null;
  progress?: { status: string } | null;
  related?: Array<{ id: string; slug: string; title: string; summary: string | null }>;
};

/**
 * Renderização compartilhada entre /app/biblioteca/[slug] (leitura real) e
 * /admin/biblioteca/[id]/preview (revisão antes de publicar) - o admin
 * precisa ver EXATAMENTE o que o usuário vai ver, nunca uma aproximação.
 * mode="preview" só desliga a ação de progresso (não faz sentido o admin
 * "marcar como lido" o próprio rascunho) e o link de "voltar".
 */
export function LibraryContentView({
  backHref,
  content,
  mode,
}: {
  backHref?: string;
  content: LibraryContentViewData;
  mode: "member" | "preview";
}) {
  const progressStatus = content.progress?.status ?? "not_started";
  const related = content.related ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {backHref ? (
        <Link className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground" href={backHref}>
          ← Voltar
        </Link>
      ) : null}

      {content.cover_image_url ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] border border-white/[0.08]">
          <Image alt="" className="object-cover" fill sizes="672px" src={content.cover_image_url} />
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-action-soft">
            {LIBRARY_PILLAR_LABELS[content.pillar as LibraryPillar] ?? content.pillar}
          </span>
          {content.category ? <span className="text-xs text-muted-2">{content.category}</span> : null}
          <span className="text-xs text-muted-2">{formatReadingTime(content.reading_time_minutes)}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl leading-[1.1] text-foreground sm:text-4xl">{content.title}</h1>
        {content.subtitle ? <p className="mt-2 text-base text-muted">{content.subtitle}</p> : null}
      </div>

      {content.summary ? <p className="max-w-[65ch] text-base leading-8 text-muted">{content.summary}</p> : null}

      <div className="max-w-[65ch] space-y-5 text-base leading-8 text-foreground">
        {content.introduction ? <p>{content.introduction}</p> : null}
        {content.body ? <div className="whitespace-pre-wrap">{content.body}</div> : null}
      </div>

      {content.practical_application ? (
        <Card className="p-4 sm:p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-action-soft">Aplicação prática</p>
          <p className="mt-2 text-sm leading-7 text-muted">{content.practical_application}</p>
        </Card>
      ) : null}

      {content.reflection_question ? (
        <Card className="p-4 sm:p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-action-soft">Pergunta de reflexão</p>
          <p className="mt-2 text-sm leading-7 text-muted">{content.reflection_question}</p>
        </Card>
      ) : null}

      {content.small_action ? (
        <Card className="p-4 sm:p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-action-soft">Uma pequena ação</p>
          <p className="mt-2 text-sm leading-7 text-muted">{content.small_action}</p>
        </Card>
      ) : null}

      {content.bible_excerpt ? (
        <Card className="p-4 sm:p-5" tone="accent">
          <p className="text-sm italic leading-7 text-foreground">&ldquo;{content.bible_excerpt}&rdquo;</p>
          {content.bible_reference ? <p className="mt-2 text-xs font-semibold text-action-soft">{content.bible_reference}</p> : null}
        </Card>
      ) : content.bible_reference ? (
        <p className="text-xs text-muted-2">Referência: {content.bible_reference}</p>
      ) : null}

      {content.final_message ? <p className="max-w-[65ch] text-base leading-8 text-muted">{content.final_message}</p> : null}

      {mode === "member" ? (
        <form action={updateLibraryProgressAction} className="flex flex-wrap gap-2">
          <input name="contentId" type="hidden" value={content.id} />
          <input name="slug" type="hidden" value={content.slug} />
          {progressStatus !== "completed" ? (
            <>
              <input name="status" type="hidden" value={progressStatus === "reading" ? "completed" : "reading"} />
              <Button size="md" type="submit">
                {progressStatus === "reading" ? "Marcar como concluído" : "Iniciar leitura"}
              </Button>
            </>
          ) : (
            <span className="rounded-full border border-action/30 bg-action/10 px-3 py-1.5 text-xs font-semibold text-action-soft">
              Concluído
            </span>
          )}
        </form>
      ) : null}

      {related.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.08] pt-5">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-2">Conteúdo relacionado</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <Link href={`/app/biblioteca/${item.slug}`} key={item.id}>
                <Card className="p-4">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  {item.summary ? <p className="mt-1 line-clamp-2 text-xs text-muted">{item.summary}</p> : null}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
