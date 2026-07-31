import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { getTipBySlug } from "@/server/services/tips.service";
import { ScrollToTopOnMount } from "@/components/member/scroll-to-top-on-mount";
import { TipImageViewer } from "@/components/member/tip-image-viewer";

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
    <div className="max-w-3xl space-y-6">
      <ScrollToTopOnMount />
      <Link
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
        href="/app/dicas"
      >
        <ArrowLeft aria-hidden="true" size={14} />
        Voltar para dicas
      </Link>

      {tip.image_url ? (
        <TipImageViewer
          alt={tip.alt_text || tip.title}
          downloadUrl={`/api/dicas/${tip.id}/download`}
          imageUrl={tip.image_url}
          title={tip.title}
        />
      ) : null}

      {tip.category ? (
        <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
          {tip.category}
        </span>
      ) : null}

      <h1 className="font-display text-3xl leading-[1.1] text-foreground sm:text-4xl">
        {tip.title}
      </h1>

      {tip.summary ? (
        <p className="text-lg leading-8 text-muted">{tip.summary}</p>
      ) : null}

      {tip.content ? (
        <p className="whitespace-pre-line text-base leading-7 text-foreground/85">{tip.content}</p>
      ) : null}
    </div>
  );
}
