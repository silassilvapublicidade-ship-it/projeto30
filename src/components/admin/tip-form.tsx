"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { TIP_CATEGORIES } from "@/features/admin/admin-tips.schemas";
import { updateTipAction, type AdminTipActionResult } from "@/features/admin/admin-tips.actions";
import type { Tables } from "@/types/database";

const initialState: AdminTipActionResult = { ok: false, message: "" };

const selectClassName =
  "min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none focus:border-action/70";

function toDateTimeLocal(value: string | null): string {
  if (!value) {
    return "";
  }
  // <input type="datetime-local"> expects "YYYY-MM-DDTHH:mm", no timezone.
  return value.slice(0, 16);
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit">
      {pending ? "Salvando" : "Salvar dica"}
    </Button>
  );
}

export function TipForm({
  challenges,
  tip,
}: {
  challenges: Array<{ id: string; name: string }>;
  tip: Tables<"content_items">;
}) {
  const [state, formAction] = useActionState(updateTipAction, initialState);
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  return (
    <form action={formAction} className="space-y-4">
      <input name="tipId" type="hidden" value={tip.id} />

      {state.message ? (
        <StatusCard
          description={state.message}
          title={state.ok ? "Tudo certo" : "Revise os campos"}
          tone={state.ok ? "success" : "error"}
        />
      ) : null}

      <Field error={fieldErrors?.title?.[0]} label="Título">
        <Input defaultValue={tip.title} maxLength={160} minLength={3} name="title" required />
      </Field>

      <Field
        error={fieldErrors?.slug?.[0]}
        hint="Usado na URL /app/dicas/[slug]. Letras minúsculas, números e hífens."
        label="Slug"
      >
        <Input defaultValue={tip.slug} maxLength={120} name="slug" required />
      </Field>

      <Field error={fieldErrors?.category?.[0]} label="Categoria">
        <select className={selectClassName} defaultValue={tip.category ?? ""} name="category" required>
          <option disabled value="">
            Selecione uma categoria
          </option>
          {TIP_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </Field>

      <Field
        error={fieldErrors?.excerpt?.[0]}
        hint="Aparece na listagem do usuário, abaixo do título."
        label="Resumo (opcional)"
      >
        <Textarea defaultValue={tip.excerpt ?? ""} maxLength={280} name="excerpt" rows={2} />
      </Field>

      <Field
        error={fieldErrors?.body?.[0]}
        hint="Se vazio, o card só mostra a imagem (sem tela de detalhe com texto)."
        label="Descrição completa (opcional)"
      >
        <Textarea defaultValue={tip.body ?? ""} maxLength={4000} name="body" rows={5} />
      </Field>

      <Field
        error={fieldErrors?.altText?.[0]}
        hint="Texto alternativo da imagem, para leitores de tela. Se vazio, usa o título."
        label="Texto alternativo (opcional)"
      >
        <Input defaultValue={tip.alt_text ?? ""} maxLength={200} name="altText" />
      </Field>

      <Field hint="Opcional - associa esta dica a um desafio específico." label="Desafio relacionado">
        <select className={selectClassName} defaultValue={tip.challenge_id ?? ""} name="challengeId">
          <option value="">Nenhum</option>
          {challenges.map((challenge) => (
            <option key={challenge.id} value={challenge.id}>
              {challenge.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        error={fieldErrors?.displayOrder?.[0]}
        hint="Menor valor aparece primeiro na listagem."
        label="Ordem de exibição"
      >
        <Input defaultValue={tip.display_order} min={0} name="displayOrder" type="number" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          error={fieldErrors?.startsAt?.[0]}
          hint="Opcional - card só aparece a partir desta data."
          label="Início da exibição"
        >
          <Input defaultValue={toDateTimeLocal(tip.starts_at)} name="startsAt" type="datetime-local" />
        </Field>
        <Field
          error={fieldErrors?.endsAt?.[0]}
          hint="Opcional - card some após esta data."
          label="Fim da exibição"
        >
          <Input defaultValue={toDateTimeLocal(tip.ends_at)} name="endsAt" type="datetime-local" />
        </Field>
      </div>

      <SaveButton />
    </form>
  );
}
