"use server";

import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

import { createUserSchema, userIdSchema } from "./admin-users.schemas";

export type AdminUserActionResult =
  | { fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { message: string; ok: true; userId?: string };

function getFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function withFeedback(path: string, feedback: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}feedback=${feedback}`;
}

/**
 * Creates the account via Supabase Auth's admin API (service_role, only
 * ever touched here on the server - never sent to the client) and lets the
 * existing on_auth_user_created trigger create the matching public.users
 * row from user_metadata, exactly like a normal signup. email_confirm is
 * set to true because an admin typing the address in is already vouching
 * for it - there is no verification email step for this flow.
 */
export async function createUserAction(
  _previousState: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  await requireAdminUser();

  const parsed = createUserSchema.safeParse({
    name: getFormValue(formData, "name"),
    email: getFormValue(formData, "email"),
    password: getFormValue(formData, "password"),
    mustChangePassword: formData.get("mustChangePassword") === "on",
    enrollChallengeId: getFormValue(formData, "enrollChallengeId"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
      ok: false,
    };
  }

  let adminClient;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    return {
      message: "A configuração segura do servidor não permite criar usuários agora.",
      ok: false,
    };
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: parsed.data.name ? { name: parsed.data.name } : {},
  });

  if (createError || !created?.user) {
    const message =
      createError?.code === "email_exists"
        ? "Já existe uma conta com este e-mail."
        : "Não foi possível criar o usuário agora.";
    return { message, ok: false };
  }

  const newUserId = created.user.id;
  const supabase = await createSupabaseServerClient();

  if (parsed.data.mustChangePassword) {
    // "Admins can manage users" RLS already permits this - no need to reach
    // for service_role beyond the auth.admin.createUser call above.
    await supabase.from("users").update({ must_change_password: true }).eq("id", newUserId);
  }

  if (parsed.data.enrollChallengeId) {
    const { error: enrollError } = await supabase.rpc("admin_enroll_user_in_challenge", {
      p_challenge_id: parsed.data.enrollChallengeId,
      p_user_id: newUserId,
    });

    if (enrollError) {
      redirect(`/admin/usuarios?feedback=create-success-enroll-failed`);
    }
  }

  redirect(`/admin/usuarios?feedback=create-success`);
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdminUser();

  const redirectToValue = formData.get("redirectTo");
  const redirectTo =
    typeof redirectToValue === "string" && redirectToValue.startsWith("/admin/usuarios")
      ? redirectToValue
      : "/admin/usuarios";

  const parsedId = userIdSchema.safeParse(formData.get("userId"));

  if (!parsedId.success) {
    redirect(withFeedback(redirectTo, "invalid"));
  }

  if (parsedId.data === admin.id) {
    redirect(withFeedback(redirectTo, "delete-self-blocked"));
  }

  let adminClient;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    redirect(withFeedback(redirectTo, "error"));
  }

  const { error } = await adminClient.auth.admin.deleteUser(parsedId.data);

  if (error) {
    redirect(withFeedback(redirectTo, "error"));
  }

  redirect(withFeedback(redirectTo, "delete-success"));
}
