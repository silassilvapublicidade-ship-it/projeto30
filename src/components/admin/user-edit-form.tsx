"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import {
  updateUserProfileAction,
  type AdminUserActionResult,
} from "@/features/admin/admin-users.actions";

const initialState: AdminUserActionResult = { ok: false, message: "" };

function getFieldError(state: AdminUserActionResult, field: string) {
  return state.ok ? undefined : state.fieldErrors?.[field]?.[0];
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit">
      {pending ? "Salvando" : "Salvar alterações"}
    </Button>
  );
}

export function UserEditForm({
  city,
  displayName,
  name,
  userId,
}: {
  city: string | null;
  displayName: string | null;
  name: string | null;
  userId: string;
}) {
  const [state, formAction] = useActionState(updateUserProfileAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input name="userId" type="hidden" value={userId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={getFieldError(state, "name")} label="Nome">
          <Input defaultValue={name ?? ""} name="name" />
        </Field>
        <Field error={getFieldError(state, "displayName")} label="Nome de exibição">
          <Input defaultValue={displayName ?? ""} name="displayName" />
        </Field>
      </div>
      <Field error={getFieldError(state, "city")} hint="Opcional." label="Cidade">
        <Input defaultValue={city ?? ""} name="city" />
      </Field>
      <div className="flex items-center gap-3">
        <SaveButton />
        {state.message ? (
          <StatusCard
            description={state.message}
            title={state.ok ? "Tudo certo" : "Revise antes de continuar"}
            tone={state.ok ? "success" : "error"}
          />
        ) : null}
      </div>
    </form>
  );
}
