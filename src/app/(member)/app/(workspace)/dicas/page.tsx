import Link from "next/link";
import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { TipCard } from "@/components/member/tip-card";
import { TIP_CATEGORIES } from "@/features/admin/admin-tips.schemas";
import { cn } from "@/lib/utils";
import { getPublishedTips } from "@/server/services/tips.service";

export const metadata: Metadata = {
  title: "Dicas",
};

type DicasPageProps = {
  searchParams: Promise<{ categoria?: string }>;
};

export default async function DicasPage({ searchParams }: DicasPageProps) {
  const { categoria } = await searchParams;
  const tips = await getPublishedTips(categoria ? { category: categoria } : {});

  return (
    <MemberEmptyPage
      description="Sugestões práticas para sustentar os hábitos dos seus desafios - sem virar mais uma cobrança no dia."
      icon={Lightbulb}
      title="Dicas"
    >
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
        role="group"
        aria-label="Filtrar por categoria"
      >
        <Link
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            !categoria
              ? "border-action/32 bg-action/14 text-action-soft"
              : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
          )}
          href="/app/dicas"
        >
          Todos
        </Link>
        {TIP_CATEGORIES.map((category) => (
          <Link
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
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

      {tips.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tips.map((tip, index) => (
            <TipCard
              altText={tip.alt_text}
              category={tip.category}
              href={`/app/dicas/${tip.slug}`}
              imageUrl={tip.image_url}
              key={tip.id}
              priority={index < 4}
              summary={tip.summary}
              title={tip.title}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted">Nenhuma dica disponível no momento.</p>
      )}
    </MemberEmptyPage>
  );
}
