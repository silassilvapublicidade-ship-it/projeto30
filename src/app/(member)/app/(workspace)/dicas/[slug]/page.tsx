import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { getTipBySlug } from "@/server/services/tips.service";

type DicaDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: DicaDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tip = await getTipBySlug(slug);
  return { title: tip?.title ?? "Dica" };
}

export default async function DicaDetailPage({ params }: DicaDetailPageProps) {
  const { slug } = await params;
  const tip = await getTipBySlug(slug);

  if (!tip) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
        href="/app/dicas"
      >
        <ArrowLeft aria-hidden="true" size={14} />
        Voltar para dicas
      </Link>

      {tip.media_url ? (
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-black sm:aspect-[16/9]">
          <Image
            alt={tip.alt_text || tip.title}
            className="object-contain"
            fill
            sizes="100vw"
            src={tip.media_url}
          />
        </div>
      ) : null}

      {tip.category ? (
        <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
          {tip.category}
        </span>
      ) : null}

      <h1 className="font-display text-3xl leading-[1.1] text-foreground sm:text-4xl">
        {tip.title}
      </h1>

      {tip.excerpt ? (
        <p className="text-lg leading-8 text-muted">{tip.excerpt}</p>
      ) : null}

      {tip.body ? (
        <p className="whitespace-pre-line text-base leading-7 text-foreground/85">{tip.body}</p>
      ) : null}
    </div>
  );
}
