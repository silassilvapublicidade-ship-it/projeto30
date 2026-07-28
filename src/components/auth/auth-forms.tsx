"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import {
  type AuthActionResult,
  sendMagicLinkFormAction,
  signInWithPasswordFormAction,
  signUpWithPasswordFormAction,
} from "@/features/auth/auth.actions";

const initialState: AuthActionResult = {
  ok: false,
  message: "",
};

function getFieldError(state: AuthActionResult, field: string) {
  if (state.ok) {
    return undefined;
  }

  return state.fieldErrors?.[field]?.[0];
}

function FormStatus({ state }: { state: AuthActionResult }) {
  if (!state.message) {
    return null;
  }

  return (
    <StatusCard
      description={state.message}
      title={state.ok ? "Tudo certo" : "Revise antes de continuar"}
      tone={state.ok ? "success" : "error"}
    />
  );
}

function SubmitButton({
  children,
  variant = "primary",
}: {
  children: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full"
      loading={pending}
      trailingIcon={<ArrowRight aria-hidden="true" size={16} />}
      type="submit"
      variant={variant}
    >
      {pending ? "Enviando" : children}
    </Button>
  );
}

export function LoginForm() {
  const [passwordState, passwordAction] = useActionState(
    signInWithPasswordFormAction,
    initialState,
  );
  const [magicState, magicAction] = useActionState(sendMagicLinkFormAction, initialState);

  return (
    <div className="space-y-5">
      <form action={passwordAction} className="space-y-4">
        <Field error={getFieldError(passwordState, "email")} label="E-mail">
          <Input
            autoComplete="email"
            name="email"
            placeholder="voce@email.com"
            required
            type="email"
          />
        </Field>
        <Field error={getFieldError(passwordState, "password")} label="Senha">
          <Input
            autoComplete="current-password"
            name="password"
            placeholder="Sua senha"
            required
            type="password"
          />
        </Field>
        <SubmitButton>Entrar</SubmitButton>
        <FormStatus state={passwordState} />
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-2">
          ou
        </span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <form action={magicAction} className="space-y-4">
        <Field
          error={getFieldError(magicState, "email")}
          hint="Enviaremos um link de acesso para o seu e-mail."
          label="Entrar com link"
        >
          <Input
            autoComplete="email"
            name="email"
            placeholder="voce@email.com"
            required
            type="email"
          />
        </Field>
        <SubmitButton variant="secondary">Receber link de acesso</SubmitButton>
        <FormStatus state={magicState} />
      </form>
    </div>
  );
}

export function SignupForm() {
  const [signupState, signupAction] = useActionState(
    signUpWithPasswordFormAction,
    initialState,
  );
  const [magicState, magicAction] = useActionState(sendMagicLinkFormAction, initialState);

  return (
    <div className="space-y-5">
      <form action={signupAction} className="space-y-4">
        <Field error={getFieldError(signupState, "email")} label="E-mail">
          <Input
            autoComplete="email"
            name="email"
            placeholder="voce@email.com"
            required
            type="email"
          />
        </Field>
        <Field
          error={getFieldError(signupState, "password")}
          hint="Use pelo menos 8 caracteres."
          label="Senha"
        >
          <Input
            autoComplete="new-password"
            name="password"
            placeholder="Crie uma senha segura"
            required
            type="password"
          />
        </Field>
        <SubmitButton>Criar conta gratuita</SubmitButton>
        <FormStatus state={signupState} />
      </form>

      <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-4">
        <form action={magicAction} className="space-y-4">
          <Field
            error={getFieldError(magicState, "email")}
            hint="Prefere começar sem senha agora? Use o link por e-mail."
            label="Acesso rápido"
          >
            <Input
              autoComplete="email"
              name="email"
              placeholder="voce@email.com"
              required
              type="email"
            />
          </Field>
          <SubmitButton variant="secondary">Receber link mágico</SubmitButton>
          <FormStatus state={magicState} />
        </form>
      </div>
    </div>
  );
}

export function PasswordRecoveryForm() {
  const [state, formAction] = useActionState(sendMagicLinkFormAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Field
        error={getFieldError(state, "email")}
        hint="Por segurança, a mensagem não confirma se o e-mail existe ou não."
        label="E-mail de acesso"
      >
        <Input
          autoComplete="email"
          name="email"
          placeholder="voce@email.com"
          required
          type="email"
        />
      </Field>
      <SubmitButton variant="secondary">Enviar link seguro</SubmitButton>
      <FormStatus state={state} />
    </form>
  );
}
