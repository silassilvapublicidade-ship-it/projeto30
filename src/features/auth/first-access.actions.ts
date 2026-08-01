"use server";

import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMustChangePasswordFlag,
  requireAuthUser,
} from "@/server/services/auth-session.service";

import { requiresPasswordReauth } from "./auth.core";
import { firstAccessSchema } from "./first-access.schemas";

export type FirstAccessActionResult =
  | { fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { message: string; ok: true };

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function completeFirstAccessAction(
  _previousState: FirstAccessActionResult,
  formData: FormData,
): Promise<FirstAccessActionResult> {
  const parsed = firstAccessSchema.safeParse({
    confirmPassword: getString(formData, "confirmPassword"),
    currentPassword: getString(formData, "currentPassword") || undefined,
    newPassword: getString(formData, "newPassword"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
      ok: false,
    };
  }

  const user = await requireAuthUser("/primeiro-acesso");

  // Re-checked server-side even though the page itself already redirects
  // away when this is false - a form submitted from a stale tab must not
  // be trusted just because it rendered while the flag was still true.
  if (!(await getMustChangePasswordFlag(user.id))) {
    redirect("/app");
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const needsCurrentPassword = requiresPasswordReauth(claimsData?.claims?.amr);

  if (needsCurrentPassword) {
    if (!parsed.data.currentPassword) {
      return {
        fieldErrors: { currentPassword: ["Informe sua senha atual."] },
        message: "Informe sua senha atual.",
        ok: false,
      };
    }

    if (!user.email) {
      return {
        message: "Sua conta não tem um e-mail válido para confirmar a senha atual.",
        ok: false,
      };
    }

    // Same real (not simulated) reauthentication as changePasswordAction:
    // Supabase Auth has no isolated "check current password" endpoint.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    });

    if (reauthError) {
      return {
        fieldErrors: { currentPassword: ["Senha atual incorreta."] },
        message: "Senha atual incorreta.",
        ok: false,
      };
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    return { message: "Não foi possível atualizar sua senha agora.", ok: false };
  }

  let admin;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      message:
        "Sua senha foi atualizada, mas a configuração segura do servidor não permite concluir agora. Tente novamente em instantes.",
      ok: false,
    };
  }

  // public.users has no self-update RLS policy (only self-read + admin
  // write), same reason updateProfileDetailsAction uses the admin client.
  await admin
    .from("users")
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/app");
}
