import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import {
  formatReadingTime,
  isLibraryPillar,
  LIBRARY_PILLAR_LABELS,
  LIBRARY_PILLARS,
} from "@/features/library/library.core";
import { getLibraryRecommendation, listLibraryContents } from "@/server/services/library.service";

export const metadata: Metadata = {
  title: "Biblioteca · Projeto 30",
};

const PAGE_SIZE = 12;

type BibliotecaPageProps = {
  searchParams: Promise<{ busca?: string; pagina?: string; pilar?: string }>;
};

export default async function BibliotecaPage({ searchParams }: BibliotecaPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina) || 1);
  const pillar = params.pilar && isLibraryPillar(params.pilar) ? params.pilar : undefined;
  const search = params.busca?.trim() || undefined;

  const [{ rows, total }, recommendation] = await Promise.all([
    listLibraryContents({ pillar, search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getLibraryRecommendation(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyFilter = Boolean(pillar || search);
  const hasAnyContent = total > 0 || hasAnyFilter;

  return (
    <MemberEmptyPage
      description="Conteúdos curtos e aplicáveis para apoiar Corpo, Mente, Caráter e Espírito ao longo da sua jornada."
      icon={BookOpen}
      title="Biblioteca"
    >
      <div className="space-y-5">
        {recommendation && !hasAnyFilter ? (
          <Card className="p-4 sm:p-5" tone="accent">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-action-soft">Recomendado para você</p>
            <Link className="mt-2 block" href={`/app/biblioteca/${recommendation.slug}`}>
              <p className="text-base font-semibold text-foreground">{recommendation.title}</p>
              {recommendation.summary ? <p className="mt-1 text-sm leading-6 text-muted">{recommendation.summary}</p> : null}
              <p className="mt-2 text-xs text-muted-2">{formatReadingTime(recommendation.reading_time_minutes)}</p>
            </Link>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              !pillar ? "border-action/40 bg-action/15 text-action-soft" : "border-white/10 text-muted hover:text-foreground"
            }`}
            href="/app/biblioteca"
          >
            Todos
          </Link>
          {LIBRARY_PILLARS.map((value) => (
            <Link
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                pillar === value ? "border-action/40 bg-action/15 text-action-soft" : "border-white/10 text-muted hover:text-foreground"
              }`}
              href={`/app/biblioteca?pilar=${value}`}
              key={value}
            >
              {LIBRARY_PILLAR_LABELS[value]}
            </Link>
          ))}
        </div>

        <form className="flex gap-2" method="get">
          {pillar ? <input name="pilar" type="hidden" value={pillar} /> : null}
          <input
            aria-label="Buscar na biblioteca"
            className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none"
            defaultValue={search ?? ""}
            name="busca"
            placeholder="Buscar conteúdos"
            type="text"
          />
          <Button size="md" type="submit">
            Buscar
          </Button>
        </form>

        {!hasAnyContent ? (
          <Card className="p-4 sm:p-6">
            <EmptyState
              description="Novos conteúdos aparecerão aqui assim que forem publicados."
              title="Ainda não há conteúdos publicados"
            />
          </Card>
        ) : rows.length === 0 ? (
          <EmptyState description="Nenhum conteúdo corresponde aos filtros atuais." title="Nada encontrado" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((item) => (
              <Link href={`/app/biblioteca/${item.slug}`} key={item.id}>
                <Card className="flex h-full flex-col p-4 sm:p-5">
                  <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-2">
                    {LIBRARY_PILLAR_LABELS[item.pillar as keyof typeof LIBRARY_PILLAR_LABELS] ?? item.pillar}
                  </span>
                  <p className="mt-2.5 text-sm font-semibold text-foreground">{item.title}</p>
                  {item.summary ? <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-muted">{item.summary}</p> : null}
                  <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-2">
                    <span>{formatReadingTime(item.reading_time_minutes)}</span>
                    {item.progress_status === "completed" ? (
                      <span className="text-action-soft">Concluído</span>
                    ) : item.progress_status === "reading" ? (
                      <span>Continuar lendo</span>
                    ) : null}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Paginação da biblioteca" className="flex items-center justify-between gap-3 pt-2">
            <Button
              as="a"
              disabled={page <= 1}
              href={`/app/biblioteca?${new URLSearchParams({ ...(pillar ? { pilar: pillar } : {}), ...(search ? { busca: search } : {}), pagina: String(page - 1) }).toString()}`}
              size="sm"
              variant="ghost"
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-2">
              Página {page} de {totalPages}
            </span>
            <Button
              as="a"
              disabled={page >= totalPages}
              href={`/app/biblioteca?${new URLSearchParams({ ...(pillar ? { pilar: pillar } : {}), ...(search ? { busca: search } : {}), pagina: String(page + 1) }).toString()}`}
              size="sm"
              variant="ghost"
            >
              Próxima
            </Button>
          </nav>
        ) : null}
      </div>
    </MemberEmptyPage>
  );
}
