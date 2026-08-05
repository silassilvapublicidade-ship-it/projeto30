import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { LibraryContentView } from "@/components/library/library-content-view";
import { adminGetLibraryContent } from "@/server/services/admin-library.service";

export const metadata: Metadata = {
  title: "Preview · Biblioteca · Administração",
};

type PreviewConteudoBibliotecaPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PreviewConteudoBibliotecaPage({ params }: PreviewConteudoBibliotecaPageProps) {
  const { id } = await params;
  const content = await adminGetLibraryContent(id);

  if (!content) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href={`/admin/biblioteca/${id}/editar`}
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para edição
        </Link>
      </div>

      <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-2">Modo preview</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Esta é exatamente a renderização que o usuário vê em /app/biblioteca. Nada aqui é publicado automaticamente.
        </p>
      </div>

      <LibraryContentView content={{ ...content, related: [] }} mode="preview" />
    </div>
  );
}
