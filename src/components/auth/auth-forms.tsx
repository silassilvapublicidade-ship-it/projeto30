"use client";

import { useActionState, useState } from "react";
import type { KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import {
  type AuthActionResult,
  sendMagicLinkFormAction,
  sendPasswordRecoveryFormAction,
  signInWithPasswordFormAction,
  signUpWithPasswordFormAction,
  updatePasswordAction,
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

function PasswordInput({
  autoComplete,
  error,
  hint,
  label,
  name,
  placeholder,
}: {
  autoComplete: string;
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
  name: string;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  function handleKeyEvent(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState("CapsLock"));
  }

  return (
    <Field error={error} hint={capsLockOn ? "Caps Lock está ativado." : hint} label={label}>
      <div className="relative">
        <Input
          autoComplete={autoComplete}
          className="pr-12"
          name={name}
          onKeyDown={handleKeyEvent}
          onKeyUp={handleKeyEvent}
          placeholder={placeholder}
          required
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 transition-colors hover:text-foreground focus-visible:outline-action-soft"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      </div>
    </Field>
  );
}

export function LoginForm({ nextPath = "/app" }: { nextPath?: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [passwordState, passwordAction] = useActionState(
    signInWithPasswordFormAction,
    initialState,
  );
  const [magicState, magicAction] = useActionState(sendMagicLinkFormAction, initialState);

  return (
    <div className="space-y-5">
      {mode === "password" ? (
        <form
          action={passwordAction}
          className="space-y-4 [animation:p30-fade-up_var(--motion-base)_var(--ease-premium)]"
          key="password"
        >
          <input name="next" type="hidden" value={nextPath} />
          <Field error={getFieldError(passwordState, "email")} label="E-mail">
            <Input
              autoComplete="email"
              name="email"
              placeholder="voce@email.com"
              required
              type="email"
            />
          </Field>
          <PasswordInput
            autoComplete="current-password"
            error={getFieldError(passwordState, "password")}
            label="Senha"
            name="password"
            placeholder="Sua senha"
          />
          <div className="flex justify-end">
            <Link
              className="text-xs font-semibold text-action-soft transition-colors hover:text-action focus-visible:outline-action-soft"
              href="/recuperar-senha"
            >
              Esqueci minha senha
            </Link>
          </div>
          <SubmitButton>Entrar</SubmitButton>
          <FormStatus state={passwordState} />
        </form>
      ) : (
        <form
          action={magicAction}
          className="space-y-4 [animation:p30-fade-up_var(--motion-base)_var(--ease-premium)]"
          key="magic"
        >
          <input name="next" type="hidden" value={nextPath} />
          <Field
            error={getFieldError(magicState, "email")}
            hint="Enviaremos um link seguro para o seu e-mail."
            label="E-mail"
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
      )}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/[0.08]" />
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-2">
          ou
        </span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>

      <button
        className="w-full text-center text-sm font-semibold text-action-soft transition-colors hover:text-action focus-visible:outline-action-soft"
        onClick={() => setMode((current) => (current === "password" ? "magic" : "password"))}
        type="button"
      >
        {mode === "password" ? "Entrar com link por e-mail" : "Entrar com senha"}
      </button>
    </div>
  );
}

export function SignupForm({ nextPath = "/app" }: { nextPath?: string }) {
  const [signupState, signupAction] = useActionState(
    signUpWithPasswordFormAction,
    initialState,
  );
  const [magicState, magicAction] = useActionState(sendMagicLinkFormAction, initialState);

  return (
    <div className="space-y-5">
      <form action={signupAction} className="space-y-4">
        <input name="next" type="hidden" value={nextPath} />
        <Field error={getFieldError(signupState, "email")} label="E-mail">
          <Input
            autoComplete="email"
            name="email"
            placeholder="voce@email.com"
            required
            type="email"
          />
        </Field>
        <PasswordInput
          autoComplete="new-password"
          error={getFieldError(signupState, "password")}
          hint="Use pelo menos 8 caracteres."
          label="Senha"
          name="password"
          placeholder="Crie uma senha segura"
        />
        <SubmitButton>Criar conta gratuita</SubmitButton>
        <FormStatus state={signupState} />
      </form>

      <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-4">
        <form action={magicAction} className="space-y-4">
          <input name="next" type="hidden" value={nextPath} />
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
  const [state, formAction] = useActionState(
    sendPasswordRecoveryFormAction,
    initialState,
  );

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

export function NewPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <PasswordInput
        autoComplete="new-password"
        error={getFieldError(state, "password")}
        hint="Use pelo menos 8 caracteres."
        label="Nova senha"
        name="password"
        placeholder="Crie uma nova senha"
      />
      <SubmitButton>Salvar nova senha</SubmitButton>
      <FormStatus state={state} />
    </form>
  );
}
