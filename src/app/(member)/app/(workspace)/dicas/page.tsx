import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { cn } from "@/lib/utils";
import { getPublishedTips, getTipCategories } from "@/server/services/tips.service";

export const metadata: Metadata = {
  title: "Dicas",
};

type DicasPageProps = {
  searchParams: Promise<{ categoria?: string }>;
};

export default async function DicasPage({ searchParams }: DicasPageProps) {
  const { categoria } = await searchParams;
  const [tips, categories] = await Promise.all([
    getPublishedTips(categoria ? { category: categoria } : {}),
    getTipCategories(),
  ]);

  return (
    <MemberEmptyPage
      description="Sugestões práticas para sustentar os hábitos dos seus desafios - sem virar mais uma cobrança no dia."
      icon={Lightbulb}
      title="Dicas"
    >
      {categories.length > 0 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          <Link
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              !categoria
                ? "border-action/32 bg-action/14 text-action-soft"
                : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
            )}
            href="/app/dicas"
          >
            Todas
          </Link>
          {categories.map((category) => (
            <Link
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                categoria === category
                  ? "border-action/32 bg-action/14 text-action-soft"
                  : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
              )}
              href={`/app/dicas?categoria=${encodeURIComponent(category)}`}
              key={category}
            >
              {category}
            </Link>
          ))}
        </div>
      ) : null}

      {tips.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tips.map((tip) => (
            <Link
              className="flex flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] shadow-[var(--shadow-soft)] transition-[border-color,transform] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-white/16"
              href={`/app/dicas/${tip.slug}`}
              key={tip.id}
            >
              {tip.media_url ? (
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                  <Image
                    alt=""
                    className="object-contain"
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    src={tip.media_url}
                  />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-2 p-4">
                {tip.category ? (
                  <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
                    {tip.category}
                  </span>
                ) : null}
                <h2 className="text-base font-semibold text-foreground">{tip.title}</h2>
                {tip.excerpt ? (
                  <p className="line-clamp-2 text-sm leading-6 text-muted">{tip.excerpt}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted">
          {categoria
            ? "Nenhuma dica publicada nesta categoria ainda."
            : "Nenhuma dica publicada ainda. Quando o time de conteúdo publicar novas dicas, elas aparecem aqui."}
        </p>
      )}
    </MemberEmptyPage>
  );
}
