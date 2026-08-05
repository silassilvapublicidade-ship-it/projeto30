import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { LibraryGenerationForm } from "@/components/admin/library-generation-form";
import { isAiProviderConfigured } from "@/server/ai/ai-provider";
import { listChallengesForTipPicker } from "@/server/services/admin-tips.service";

export const metadata: Metadata = {
  title: "Gerar com IA · Biblioteca · Administração",
};

export default async function GerarConteudoBibliotecaPage() {
  const configured = isAiProviderConfigured();
  const challenges = configured ? await listChallengesForTipPicker() : [];

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
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Gerar conteúdo com IA</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          A IA gera um rascunho a partir do tema que você descrever. Nada é publicado sem revisão humana.
        </p>
      </div>

      {configured ? (
        <LibraryGenerationForm challenges={challenges} />
      ) : (
        <div className="max-w-2xl rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-5">
          <p className="text-sm font-semibold text-foreground">IA não configurada</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Nenhum provedor de IA está configurado neste ambiente (falta a variável ANTHROPIC_API_KEY). Você
            ainda pode criar conteúdos manualmente em{" "}
            <Link className="text-action-soft hover:underline" href="/admin/biblioteca/nova">
              Novo conteúdo
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
