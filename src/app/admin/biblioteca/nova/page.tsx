import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { LibraryContentForm } from "@/components/admin/library-content-form";
import { listChallengesForTipPicker } from "@/server/services/admin-tips.service";

export const metadata: Metadata = {
  title: "Novo conteúdo · Biblioteca · Administração",
};

export default async function NovoConteudoBibliotecaPage() {
  const challenges = await listChallengesForTipPicker();

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/biblioteca"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para Biblioteca
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Novo conteúdo</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Nasce sempre como rascunho. Envie para revisão e aprove antes de publicar.
        </p>
      </div>

      <LibraryContentForm challenges={challenges} />
    </div>
  );
}
