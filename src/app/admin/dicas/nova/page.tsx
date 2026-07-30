import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { createTipDraftAction } from "@/features/admin/admin-tips.actions";
import { TIP_CATEGORIES } from "@/features/admin/admin-tips.schemas";

export const metadata: Metadata = {
  title: "Nova dica · Administração",
};

const feedbackMessages: Record<string, { description: string; title: string }> = {
  invalid: {
    description: "Informe um título com pelo menos 3 caracteres.",
    title: "Dados incompletos",
  },
  error: { description: "Não foi possível criar o rascunho agora.", title: "Erro ao criar" },
};

export default async function NovaDicaPage({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string }>;
}) {
  const { feedback: feedbackKey } = await searchParams;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/dicas"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para dicas
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Nova dica</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Cria um rascunho mínimo. Imagem, resumo, descrição e demais campos são configurados na
          tela de edição, antes da publicação.
        </p>
      </div>

      {feedback ? (
        <StatusCard description={feedback.description} title={feedback.title} tone="error" />
      ) : null}

      <form action={createTipDraftAction} className="space-y-4">
        <Field label="Título">
          <Input maxLength={160} minLength={3} name="title" required />
        </Field>
        <Field hint="Pode ser ajustada depois." label="Categoria (opcional)">
          <select
            className="min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none focus:border-action/70"
            defaultValue=""
            name="category"
          >
            <option value="">Sem categoria</option>
            {TIP_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit">Criar rascunho</Button>
      </form>
    </div>
  );
}
