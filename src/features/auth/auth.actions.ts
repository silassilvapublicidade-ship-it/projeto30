"use server";

import { getServerEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { magicLinkSchema, passwordAuthSchema } from "./auth.schemas";

export type AuthActionResult =
  | {
      ok: true;
      message: string;
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
      message: "Não foi possível entrar com esses dados.",
    };
  }

  return {
    ok: true,
    message: "Entrada confirmada.",
  };
}

export async function signUpWithPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
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
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: getServerEnv().AUTH_REDIRECT_URL,
    },
  });

  if (error) {
    return {
      ok: false,
      message: "Não foi possível criar a conta agora.",
    };
  }

  return {
    ok: true,
    message: "Conta criada. Verifique seu e-mail para continuar.",
  };
}

export async function sendMagicLinkAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = magicLinkSchema.safeParse({
    email: getString(formData, "email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Informe um e-mail válido.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: getServerEnv().AUTH_REDIRECT_URL,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return {
      ok: false,
      message: "Não foi possível enviar o link agora.",
    };
  }

  return {
    ok: true,
    message: "Link enviado. Abra o e-mail neste dispositivo para continuar.",
  };
}

export async function signOutAction(): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return {
      ok: false,
      message: "Não foi possível encerrar a sessão agora.",
    };
  }

  return {
    ok: true,
    message: "Sessão encerrada.",
  };
}
