"use server";

import { redirect } from "next/navigation";

import { getSafeNextPath, withNextParam } from "@/lib/auth/redirects";
import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  magicLinkSchema,
  passwordAuthSchema,
  updatePasswordSchema,
} from "./auth.schemas";

export type AuthActionResult =
  | {
      ok: true;
      message: string;
      redirectTo?: string;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function signInWithPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const redirectTo = getSafeNextPath(formData.get("next"));
  const parsed = passwordAuthSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      ok: false,
      message: "Nao foi possivel entrar com esses dados.",
    };
  }

  return {
    ok: true,
    message: "Entrada confirmada.",
    redirectTo,
  };
}

export async function signInWithPasswordFormAction(
  _previousState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const result = await signInWithPasswordAction(formData);

  if (result.ok && result.redirectTo) {
    redirect(result.redirectTo);
  }

  return result;
}

export async function signUpWithPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const redirectTo = getSafeNextPath(formData.get("next"));
  const parsed = passwordAuthSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: withNextParam(getServerEnv().AUTH_REDIRECT_URL, redirectTo),
    },
  });

  if (error) {
    return {
      ok: false,
      message: "Nao foi possivel criar a conta agora.",
    };
  }

  if (data.session) {
    return {
      ok: true,
      message: "Conta criada. Preparando sua area de membros.",
      redirectTo,
    };
  }

  return {
    ok: true,
    message: "Conta criada. Verifique seu e-mail para continuar.",
  };
}

export async function signUpWithPasswordFormAction(
  _previousState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const result = await signUpWithPasswordAction(formData);

  if (result.ok && result.redirectTo) {
    redirect(result.redirectTo);
  }

  return result;
}

export async function sendMagicLinkAction(formData: FormData): Promise<AuthActionResult> {
  const redirectTo = getSafeNextPath(formData.get("next"));
  const parsed = magicLinkSchema.safeParse({
    email: getString(formData, "email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Informe um e-mail valido.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: withNextParam(getServerEnv().AUTH_REDIRECT_URL, redirectTo),
      shouldCreateUser: true,
    },
  });

  if (error) {
    return {
      ok: false,
      message: "Nao foi possivel enviar o link agora.",
    };
  }

  return {
    ok: true,
    message: "Link enviado. Abra o e-mail neste dispositivo para continuar.",
  };
}

export async function sendMagicLinkFormAction(
  _previousState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  return sendMagicLinkAction(formData);
}

export async function sendPasswordRecoveryAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = magicLinkSchema.safeParse({
    email: getString(formData, "email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Informe um e-mail valido.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: withNextParam(getServerEnv().AUTH_REDIRECT_URL, "/nova-senha"),
  });

  if (error) {
    return {
      ok: false,
      message: "Nao foi possivel enviar o link agora.",
    };
  }

  return {
    ok: true,
    message:
      "Se o e-mail estiver cadastrado, enviaremos um link para definir uma nova senha.",
  };
}

export async function sendPasswordRecoveryFormAction(
  _previousState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  return sendPasswordRecoveryAction(formData);
}

export async function updatePasswordAction(
  _previousState: AuthActionResult,
  formData: FormData,
): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise a nova senha.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      message: "Nao foi possivel atualizar sua senha agora.",
    };
  }

  redirect("/app");
}

export async function signOutAction(): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      ok: false,
      message: "Nao foi possivel encerrar a sessao agora.",
    };
  }

  return {
    ok: true,
    message: "Sessao encerrada.",
  };
}

export async function signOutAndRedirectAction() {
  await signOutAction();
  redirect("/login?logout=1");
}
