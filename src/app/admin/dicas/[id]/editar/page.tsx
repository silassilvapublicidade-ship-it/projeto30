import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { TipForm } from "@/components/admin/tip-form";
import { TipImageUploader } from "@/components/admin/tip-image-uploader";
import { StatusCard } from "@/components/ui/feedback";
import { getAdminTipById, listChallengesForTipPicker } from "@/server/services/admin-tips.service";

type EditarDicaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feedback?: string }>;
};

export async function generateMetadata({ params }: EditarDicaPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data: tip } = await getAdminTipById(id);
  return { title: tip ? `Editar ${tip.title} · Administração` : "Editar dica · Administração" };
}

export default async function EditarDicaPage({ params, searchParams }: EditarDicaPageProps) {
  const { id } = await params;
  const { feedback } = await searchParams;
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
            Ver prévia →
          </Link>
        </div>
      </div>

      {feedback === "create-success" ? (
        <StatusCard
          description="Continue ajustando os detalhes abaixo ou volte para a listagem."
          title="Card criado"
          tone="success"
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <TipImageUploader currentImageUrl={tip.image_url} tipId={tip.id} />
        <TipForm challenges={challenges} tip={tip} />
      </div>
    </div>
  );
}
