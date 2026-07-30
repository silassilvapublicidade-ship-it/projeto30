"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TIP_CATEGORIES } from "@/features/admin/admin-tips.schemas";
import { updateTipAction, type AdminTipActionResult } from "@/features/admin/admin-tips.actions";
import type { Tables } from "@/types/database";

const initialState: AdminTipActionResult = { ok: false, message: "" };

const categoryOptions = TIP_CATEGORIES.map((category) => ({ label: category, value: category }));

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
  const challengeOptions = [
    { label: "Nenhum", value: "" },
    ...challenges.map((challenge) => ({ label: challenge.name, value: challenge.id })),
  ];

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

      <Select
        defaultValue={tip.category ?? ""}
        error={fieldErrors?.category?.[0]}
        label="Categoria"
        name="category"
        options={categoryOptions}
        placeholder="Selecione uma categoria"
        required
      />

      <Field
        error={fieldErrors?.summary?.[0]}
        hint="Aparece na listagem do usuário, abaixo do título."
        label="Resumo (opcional)"
      >
        <Textarea defaultValue={tip.summary ?? ""} maxLength={280} name="summary" rows={2} />
      </Field>

      <Field
        error={fieldErrors?.content?.[0]}
        hint="Se vazio, o card só mostra a imagem (sem tela de detalhe com texto)."
        label="Descrição completa (opcional)"
      >
        <Textarea defaultValue={tip.content ?? ""} maxLength={4000} name="content" rows={5} />
      </Field>

      <Field
        error={fieldErrors?.altText?.[0]}
        hint="Texto alternativo da imagem, para leitores de tela. Se vazio, usa o título."
        label="Texto alternativo (opcional)"
      >
        <Input defaultValue={tip.alt_text ?? ""} maxLength={200} name="altText" />
      </Field>

      <Select
        defaultValue={tip.challenge_id ?? ""}
        label="Desafio relacionado (opcional)"
        name="challengeId"
        options={challengeOptions}
        placeholder="Nenhum"
      />

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
