"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import type { MemberActionResult } from "@/features/member/member.actions";
import { updateProfileDetailsAction } from "@/features/member/profile.actions";

const initialState: MemberActionResult = { ok: false, message: "" };

function getFieldError(state: MemberActionResult, field: string) {
  return state.ok ? undefined : state.fieldErrors?.[field]?.[0];
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit">
      {pending ? "Salvando" : "Salvar informações"}
    </Button>
  );
}

export function ProfileDetailsForm({
  city,
  displayName,
  email,
  name,
}: {
  city: string | null;
  displayName: string | null;
  email: string;
  name: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileDetailsAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="E-mail">
        <Input disabled readOnly title="O e-mail não pode ser alterado nesta fase." value={email} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={getFieldError(state, "name")} label="Nome completo">
          <Input defaultValue={name ?? ""} maxLength={120} name="name" required />
        </Field>
        <Field error={getFieldError(state, "displayName")} label="Nome de exibição">
          <Input defaultValue={displayName ?? ""} maxLength={80} name="displayName" required />
        </Field>
      </div>

      <Field error={getFieldError(state, "city")} label="Cidade" hint="Opcional.">
        <Input defaultValue={city ?? ""} maxLength={120} name="city" />
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SaveButton />
        {state.message ? (
          <StatusCard
            className="sm:flex-1"
            description={state.message}
            title={state.ok ? "Tudo certo" : "Revise antes de continuar"}
            tone={state.ok ? "success" : "error"}
          />
        ) : null}
      </div>
    </form>
  );
}
