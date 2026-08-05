import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { TipCreateForm } from "@/components/admin/tip-create-form";
import { listChallengesForTipPicker } from "@/server/services/admin-tips.service";
import { listPublishedLibraryContentsForPicker } from "@/server/services/admin-library.service";

export const metadata: Metadata = {
  title: "Novo card de dica · Administração",
};

export default async function NovoCardDeDicaPage() {
  const [challenges, libraryContents] = await Promise.all([
    listChallengesForTipPicker(),
    listPublishedLibraryContentsForPicker(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/dicas"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para dicas
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Novo card de dica</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Envie a imagem, preencha as informações e salve como rascunho ou publique diretamente.
        </p>
      </div>

      <TipCreateForm challenges={challenges} libraryContents={libraryContents} />
    </div>
  );
}
