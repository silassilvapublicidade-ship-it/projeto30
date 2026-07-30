import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { TipForm } from "@/components/admin/tip-form";
import { TipImageUploader } from "@/components/admin/tip-image-uploader";
import { getAdminTipById, listChallengesForTipPicker } from "@/server/services/admin-tips.service";

type EditarDicaPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EditarDicaPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data: tip } = await getAdminTipById(id);
  return { title: tip ? `Editar ${tip.title} · Administração` : "Editar dica · Administração" };
}

export default async function EditarDicaPage({ params }: EditarDicaPageProps) {
  const { id } = await params;
  const [{ data: tip }, challenges] = await Promise.all([
    getAdminTipById(id),
    listChallengesForTipPicker(),
  ]);

  if (!tip) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/dicas"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para dicas
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Editar dica</h1>
          <Link
            className="text-xs font-semibold text-muted transition-colors hover:text-foreground"
            href={`/admin/dicas/${tip.id}/preview`}
          >
            Ver preview →
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <TipImageUploader currentImageUrl={tip.media_url} tipId={tip.id} />
        <TipForm challenges={challenges} tip={tip} />
      </div>
    </div>
  );
}
