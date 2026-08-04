"use server";

import { randomBytes } from "node:crypto";

import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { recordSystemError } from "@/server/services/system-observability.service";

import {
  createUserSchema,
  updateUserProfileSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdSchema,
} from "./admin-users.schemas";

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
  const admin = await requireAdminUser();

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
    if (createError?.code !== "email_exists") {
      await recordSystemError({
        area: "admin",
        operation: "admin_create_user",
        severity: "error",
        message: "Falha ao criar usuário via auth.admin.createUser.",
        route: "/admin/usuarios/novo",
        userId: admin.id,
      });
    }

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

  await supabase.from("admin_audit_logs").insert({
    action: "admin_create_user",
    admin_user_id: admin.id,
    entity_id: newUserId,
    entity_type: "user",
    after_json: { email: parsed.data.email },
  });

  if (parsed.data.enrollChallengeId) {
    const { error: enrollError } = await supabase.rpc("admin_enroll_user_in_challenge", {
      p_challenge_id: parsed.data.enrollChallengeId,
      p_user_id: newUserId,
    });

    if (enrollError) {
      await recordSystemError({
        area: "admin",
        operation: "admin_enroll_user_in_challenge",
        severity: "warning",
        message: "Usuário criado, mas a inscrição automática no desafio falhou.",
        route: "/admin/usuarios/novo",
        postgresCode: enrollError.code,
        userId: admin.id,
      });
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

  const supabase = await createSupabaseServerClient();

  // Authoritative server-side guard (also blocks self-deletion and the sole
  // super_admin case) - the check above is just a fast-fail for the common
  // case, this is what actually can't be bypassed.
  const { error: guardError } = await supabase.rpc("admin_assert_user_deletable", {
    p_user_id: parsedId.data,
  });

  if (guardError) {
    redirect(
      withFeedback(redirectTo, guardError.code === "P0007" ? "delete-blocked" : "error"),
    );
  }

  const { data: targetProfile } = await supabase
    .from("users")
    .select("email")
    .eq("id", parsedId.data)
    .maybeSingle();

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

  await supabase.from("admin_audit_logs").insert({
    action: "admin_delete_user",
    admin_user_id: admin.id,
    entity_id: parsedId.data,
    entity_type: "user",
    before_json: { email: targetProfile?.email ?? null },
  });

  redirect(withFeedback(redirectTo, "delete-success"));
}

export type ResetPasswordActionResult =
  | { message: string; ok: false }
  | { message: string; ok: true; temporaryPassword: string };

/**
 * Deliberately does not redirect: the generated password can only be shown
 * once, so it has to come back as action state and render inline instead of
 * ever touching a URL (query params end up in browser history / server
 * logs).
 */
export async function resetUserPasswordAction(
  _previousState: ResetPasswordActionResult,
  formData: FormData,
): Promise<ResetPasswordActionResult> {
  const admin = await requireAdminUser();
  const parsedId = userIdSchema.safeParse(formData.get("userId"));

  if (!parsedId.success) {
    return { message: "Identificador de usuário inválido.", ok: false };
  }

  let adminClient;

  try {
    adminClient = createSupabaseAdminClient();
  } catch {
    return {
      message: "A configuração segura do servidor não permite redefinir senhas agora.",
      ok: false,
    };
  }

  const temporaryPassword = randomBytes(12).toString("base64url");

  const { error: updateError } = await adminClient.auth.admin.updateUserById(parsedId.data, {
    password: temporaryPassword,
  });

  if (updateError) {
    return { message: "Não foi possível redefinir a senha agora.", ok: false };
  }

  const supabase = await createSupabaseServerClient();

  // "Admins can manage users" RLS already permits this - no need for
  // service_role beyond the auth.admin.updateUserById call above.
  await supabase
    .from("users")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("id", parsedId.data);

  // Never logs the password itself - only that a reset happened, by whom,
  // and for which account.
  await supabase.from("admin_audit_logs").insert({
    action: "admin_reset_user_password",
    admin_user_id: admin.id,
    entity_id: parsedId.data,
    entity_type: "user",
  });

  return {
    message: "Senha temporária gerada. Compartilhe com segurança - ela não será exibida novamente.",
    ok: true,
    temporaryPassword,
  };
}

function getRedirectTo(formData: FormData): string {
  const value = formData.get("redirectTo");
  return typeof value === "string" && value.startsWith("/admin/usuarios") ? value : "/admin/usuarios";
}

const RPC_ERROR_FEEDBACK: Record<string, string> = {
  P0002: "not-found",
  P0007: "action-blocked",
};

function feedbackForRpcError(code: string | undefined): string {
  return (code && RPC_ERROR_FEEDBACK[code]) || "error";
}

/** Flips must_change_password without rotating the password itself - for
 * when the policy reason is "we want a change" rather than "this password
 * may be compromised" (that case is resetUserPasswordAction). */
export async function requirePasswordChangeAction(formData: FormData) {
  await requireAdminUser();
  const redirectTo = getRedirectTo(formData);
  const parsedId = userIdSchema.safeParse(formData.get("userId"));

  if (!parsedId.success) {
    redirect(withFeedback(redirectTo, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("id", parsedId.data);

  if (error) {
    redirect(withFeedback(redirectTo, "error"));
  }

  redirect(withFeedback(redirectTo, "require-password-change-success"));
}

export async function updateUserStatusAction(formData: FormData) {
  await requireAdminUser();
  const redirectTo = getRedirectTo(formData);

  const parsed = updateUserStatusSchema.safeParse({
    status: formData.get("status"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    redirect(withFeedback(redirectTo, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_user_status", {
    p_new_status: parsed.data.status,
    p_user_id: parsed.data.userId,
  });

  if (error) {
    redirect(withFeedback(redirectTo, feedbackForRpcError(error.code)));
  }

  redirect(withFeedback(redirectTo, "status-updated"));
}

export async function updateUserRoleAction(formData: FormData) {
  await requireAdminUser();
  const redirectTo = getRedirectTo(formData);

  const parsed = updateUserRoleSchema.safeParse({
    role: formData.get("role"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    redirect(withFeedback(redirectTo, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_user_role", {
    p_new_role: parsed.data.role,
    p_user_id: parsed.data.userId,
  });

  if (error) {
    redirect(
      withFeedback(redirectTo, error.code === "42501" ? "role-forbidden" : feedbackForRpcError(error.code)),
    );
  }

  redirect(withFeedback(redirectTo, "role-updated"));
}

export async function updateUserProfileAction(
  _previousState: AdminUserActionResult,
  formData: FormData,
): Promise<AdminUserActionResult> {
  await requireAdminUser();

  const parsed = updateUserProfileSchema.safeParse({
    city: getFormValue(formData, "city"),
    displayName: getFormValue(formData, "displayName"),
    name: getFormValue(formData, "name"),
    userId: formData.get("userId"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
      ok: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_update_user_profile", {
    p_city: parsed.data.city ?? "",
    p_display_name: parsed.data.displayName,
    p_name: parsed.data.name,
    p_user_id: parsed.data.userId,
  });

  if (error) {
    return { message: "Não foi possível salvar as alterações agora.", ok: false };
  }

  return { message: "Perfil atualizado.", ok: true };
}

export async function enrollUserInChallengeAction(formData: FormData) {
  await requireAdminUser();
  const redirectTo = getRedirectTo(formData);

  const parsedUserId = userIdSchema.safeParse(formData.get("userId"));
  const parsedChallengeId = userIdSchema.safeParse(formData.get("challengeId"));

  if (!parsedUserId.success || !parsedChallengeId.success) {
    redirect(withFeedback(redirectTo, "invalid"));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_enroll_user_in_challenge", {
    p_challenge_id: parsedChallengeId.data,
    p_user_id: parsedUserId.data,
  });

  if (error) {
    redirect(withFeedback(redirectTo, "enroll-failed"));
  }

  redirect(withFeedback(redirectTo, "enroll-success"));
}
