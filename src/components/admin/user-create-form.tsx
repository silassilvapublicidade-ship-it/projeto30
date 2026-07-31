"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import {
  type AdminUserActionResult,
  createUserAction,
} from "@/features/admin/admin-users.actions";
import type { PublishedChallengeOption } from "@/server/services/admin-users.service";

const initialState: AdminUserActionResult = { ok: false, message: "" };

function getFieldError(state: AdminUserActionResult, field: string) {
  if (state.ok) {
    return undefined;
  }

  return state.fieldErrors?.[field]?.[0];
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} trailingIcon={<ArrowRight aria-hidden="true" size={16} />} type="submit">
      {pending ? "Criando" : "Criar usuário"}
    </Button>
  );
}

export function UserCreateForm({ challenges }: { challenges: PublishedChallengeOption[] }) {
  const [state, formAction] = useActionState(createUserAction, initialState);

  const enrollOptions = [
    { label: "Nenhum", value: "" },
    ...challenges.map((challenge) => ({ label: challenge.name, value: challenge.id })),
  ];

  return (
    <form action={formAction} className="space-y-5">
      <Field error={getFieldError(state, "name")} hint="Opcional." label="Nome">
        <Input autoComplete="name" name="name" placeholder="Nome completo" />
      </Field>

      <Field error={getFieldError(state, "email")} label="E-mail">
        <Input
          autoComplete="email"
          name="email"
          placeholder="pessoa@email.com"
          required
          type="email"
        />
      </Field>

      <Field
        error={getFieldError(state, "password")}
        hint="Compartilhe com segurança - o usuário poderá trocar depois."
        label="Senha"
      >
        <Input
          autoComplete="new-password"
          name="password"
          placeholder="Defina uma senha inicial"
          required
          type="password"
        />
      </Field>

      <Checkbox
        description="Prepara a conta para exigir uma nova senha - a aplicação dessa regra chega em uma fase futura."
        label="Obrigar troca de senha no primeiro acesso"
        name="mustChangePassword"
      />

      <Select
        label="Inscrever automaticamente em"
        name="enrollChallengeId"
        options={enrollOptions}
        placeholder="Nenhum"
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <SubmitButton />
        <Button as="a" href="/admin/usuarios" variant="ghost">
          Cancelar
        </Button>
      </div>

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
