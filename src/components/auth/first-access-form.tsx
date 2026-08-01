"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordField } from "@/components/member/password-field";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import {
  completeFirstAccessAction,
  type FirstAccessActionResult,
} from "@/features/auth/first-access.actions";

const initialState: FirstAccessActionResult = { ok: false, message: "" };

function getFieldError(state: FirstAccessActionResult, field: string) {
  return state.ok ? undefined : state.fieldErrors?.[field]?.[0];
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" loading={pending} type="submit">
      {pending ? "Salvando" : "Definir nova senha"}
    </Button>
  );
}

export function FirstAccessForm({ needsCurrentPassword }: { needsCurrentPassword: boolean }) {
  const [state, formAction] = useActionState(completeFirstAccessAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {needsCurrentPassword ? (
        <PasswordField
          autoComplete="current-password"
          error={getFieldError(state, "currentPassword")}
          label="Senha atual"
          name="currentPassword"
        />
      ) : null}
      <PasswordField
        autoComplete="new-password"
        error={getFieldError(state, "newPassword")}
        hint="Pelo menos 8 caracteres, diferente da senha atual."
        label="Nova senha"
        name="newPassword"
      />
      <PasswordField
        autoComplete="new-password"
        error={getFieldError(state, "confirmPassword")}
        label="Confirmar nova senha"
        name="confirmPassword"
      />

      <SubmitButton />
      {state.message ? (
        <StatusCard
          description={state.message}
          title={state.ok ? "Tudo certo" : "Revise antes de continuar"}
          tone={state.ok ? "success" : "error"}
        />
      ) : null}
    </form>
  );
}
