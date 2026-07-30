import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { createChallengeDraftAction } from "@/features/admin/challenge-editor.actions";

export const metadata: Metadata = {
  title: "Novo desafio · Administração",
};

const feedbackMessages: Record<string, { description: string; title: string }> = {
  invalid: {
    description: "Informe um nome com pelo menos 3 caracteres e uma duração válida.",
    title: "Dados incompletos",
  },
  "slug-taken": {
    description: "Já existe um desafio com esse slug. Escolha outro.",
    title: "Slug em uso",
  },
  error: { description: "Não foi possível criar o rascunho agora.", title: "Erro ao criar" },
};

export default async function NovoDesafioPage({
  searchParams,
}: {
  searchParams: Promise<{ feedback?: string }>;
}) {
  const { feedback: feedbackKey } = await searchParams;
  const feedback = feedbackKey ? feedbackMessages[feedbackKey] : undefined;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          href="/admin/desafios"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Voltar para desafios
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Novo desafio</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          Cria um rascunho mínimo. Identidade completa, calendário, regras e hábitos são
          configurados na tela de edição, antes da publicação.
        </p>
      </div>

      {feedback ? (
        <StatusCard description={feedback.description} title={feedback.title} tone="error" />
      ) : null}

      <form action={createChallengeDraftAction} className="space-y-4">
        <Field label="Nome do desafio">
          <Input maxLength={120} minLength={3} name="name" required />
        </Field>
        <Field hint="Opcional - se vazio, é gerado a partir do nome." label="Slug">
          <Input maxLength={120} name="slug" placeholder="ex: desafio-setembro-foco" />
        </Field>
        <Field hint="Quantos dias este ciclo dura." label="Duração (dias)">
          <Input defaultValue={30} max={366} min={1} name="durationDays" required type="number" />
        </Field>
        <Field hint="Opcional - pode ser preenchida depois." label="Descrição">
          <Textarea maxLength={4000} name="description" rows={4} />
        </Field>
        <Button size="lg" type="submit">
          Criar rascunho
        </Button>
      </form>
    </div>
  );
}
