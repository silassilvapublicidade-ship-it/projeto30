"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordField } from "@/components/member/password-field";
import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import type { MemberActionResult } from "@/features/member/member.actions";
import { changePasswordAction } from "@/features/member/profile.actions";

const initialState: MemberActionResult = { ok: false, message: "" };

function getFieldError(state: MemberActionResult, field: string) {
  return state.ok ? undefined : state.fieldErrors?.[field]?.[0];
}

function ChangePasswordButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit">
      {pending ? "Atualizando" : "Atualizar senha"}
    </Button>
  );
}

export function ProfileSecurityForm() {
  const [state, formAction] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4" key={state.ok ? "reset" : "form"}>
      <PasswordField
        autoComplete="current-password"
        error={getFieldError(state, "currentPassword")}
        label="Senha atual"
        name="currentPassword"
      />
      <PasswordField
        autoComplete="new-password"
        error={getFieldError(state, "newPassword")}
        hint="Use pelo menos 8 caracteres."
        label="Nova senha"
        name="newPassword"
      />
      <PasswordField
        autoComplete="new-password"
        error={getFieldError(state, "confirmPassword")}
        label="Confirmar nova senha"
        name="confirmPassword"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChangePasswordButton />
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
