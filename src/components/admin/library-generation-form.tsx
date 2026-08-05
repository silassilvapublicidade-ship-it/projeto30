"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { generateLibraryContentDraftAction } from "@/features/admin/admin-library-generation.actions";
import { LIBRARY_PILLARS, LIBRARY_PILLAR_LABELS } from "@/features/library/library.core";
import { LIBRARY_GENERATION_TONES, LIBRARY_GENERATION_TONE_LABELS } from "@/server/ai/library-content-generation.schema";

const initialState = { message: "", ok: false as const };

const toneOptions = LIBRARY_GENERATION_TONES.map((tone) => ({ label: LIBRARY_GENERATION_TONE_LABELS[tone], value: tone }));
const pillarOptions = [
  { label: "Deixar a IA sugerir", value: "" },
  ...LIBRARY_PILLARS.map((pillar) => ({ label: LIBRARY_PILLAR_LABELS[pillar], value: pillar })),
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} loading={pending} type="submit">
      {pending ? "Gerando rascunho" : "Gerar rascunho"}
    </Button>
  );
}

export function LibraryGenerationForm({
  challenges,
}: {
  challenges: Array<{ id: string; name: string }>;
}) {
  const [state, formAction] = useActionState(generateLibraryContentDraftAction, initialState);
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  const challengeOptions = [
    { label: "Nenhum", value: "" },
    ...challenges.map((challenge) => ({ label: challenge.name, value: challenge.id })),
  ];

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {!state.ok && state.message ? <StatusCard description={state.message} title="Não foi possível gerar" tone="error" /> : null}

      <Field
        error={fieldErrors?.topic?.[0]}
        hint="Descreva o tema em algumas frases - a IA usa só isto e o tom/pilar abaixo, nunca dados de usuários."
        label="Tema/tópico"
      >
        <Textarea maxLength={600} name="topic" required rows={3} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select error={fieldErrors?.tone?.[0]} label="Tom" name="tone" options={toneOptions} placeholder="Selecione um tom" required />
        <Select error={fieldErrors?.pillarHint?.[0]} label="Pilar" name="pillarHint" options={pillarOptions} placeholder="Deixar a IA sugerir" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria (opcional)">
          <Input maxLength={80} name="category" />
        </Field>
        <Field hint="Estimativa - a IA pode sugerir outro valor." label="Tempo de leitura alvo (opcional)">
          <Input min={1} name="targetReadingMinutes" type="number" />
        </Field>
      </div>

      <Select label="Desafio relacionado (opcional)" name="relatedChallengeId" options={challengeOptions} placeholder="Nenhum" />

      <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4 text-xs leading-5 text-muted-2">
        O rascunho gerado nasce como <strong className="text-foreground">rascunho</strong> - nunca é publicado
        automaticamente. Trechos bíblicos nunca são gerados por IA: preencha manualmente após conferir a
        referência. Conteúdos sobre saúde, treino, fé ou apoio emocional recebem sugestão automática de
        revisão reforçada.
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton />
        <Button as="a" href="/admin/biblioteca" type="button" variant="ghost">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
