"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";

import type { MemberActionResult } from "./member.actions";
import {
  changePasswordSchema,
  profileDetailsSchema,
  validateAvatarUpload,
} from "./profile.schemas";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateProfileDetailsAction(
  _previousState: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  const parsed = profileDetailsSchema.safeParse({
    city: getString(formData, "city"),
    displayName: getString(formData, "displayName"),
    name: getString(formData, "name"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await requireAuthUser("/app/perfil/editar");

  let admin;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      message: "A configuração segura do servidor ainda não permite salvar o perfil.",
    };
  }

  const { error } = await admin
    .from("users")
    .update({
      city: parsed.data.city ?? null,
      display_name: parsed.data.displayName,
      name: parsed.data.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: "Não foi possível salvar seu perfil agora." };
  }

  revalidatePath("/app/perfil/editar", "layout");

  return { ok: true, message: "Perfil atualizado." };
}

export async function uploadAvatarAction(
  _previousState: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecione uma imagem para enviar." };
  }

  const validation = validateAvatarUpload({ size: file.size, type: file.type });

  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }

  const user = await requireAuthUser("/app/perfil/editar");
  const supabase = await createSupabaseServerClient();
  const path = `${user.id}/profile.${validation.extension}`;

  // Melhor esforço: remove qualquer avatar anterior com extensão diferente
  // para não deixar arquivos órfãos no bucket do usuário.
  const { data: existingFiles } = await supabase.storage.from("avatars").list(user.id);
  const staleFiles = (existingFiles ?? [])
    .filter((item) => item.name !== `profile.${validation.extension}`)
    .map((item) => `${user.id}/${item.name}`);

  if (staleFiles.length > 0) {
    await supabase.storage.from("avatars").remove(staleFiles);
  }

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return { ok: false, message: "Não foi possível enviar a imagem agora." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  let admin;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      message: "A configuração segura do servidor ainda não permite salvar a foto.",
    };
  }

  const { error: updateError } = await admin
    .from("users")
    .update({
      avatar_url: `${publicUrl}?v=${Date.now()}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return {
      ok: false,
      message: "A imagem foi enviada, mas não foi possível salvar no seu perfil.",
    };
  }

  revalidatePath("/app/perfil/editar", "layout");

  return { ok: true, message: "Foto atualizada." };
}

export async function removeAvatarAction(
  // useActionState always calls the action as (previousState, formData);
  // neither is needed here since removing the avatar takes no input.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previousState: MemberActionResult,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<MemberActionResult> {
  const user = await requireAuthUser("/app/perfil/editar");
  const supabase = await createSupabaseServerClient();

  const { data: existingFiles } = await supabase.storage.from("avatars").list(user.id);
  const paths = (existingFiles ?? []).map((item) => `${user.id}/${item.name}`);

  if (paths.length > 0) {
    await supabase.storage.from("avatars").remove(paths);
  }

  let admin;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      message: "A configuração segura do servidor ainda não permite remover a foto.",
    };
  }

  const { error } = await admin
    .from("users")
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: "Não foi possível remover a foto agora." };
  }

  revalidatePath("/app/perfil/editar", "layout");

  return { ok: true, message: "Foto removida." };
}

export async function changePasswordAction(
  _previousState: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  const parsed = changePasswordSchema.safeParse({
    confirmPassword: getString(formData, "confirmPassword"),
    currentPassword: getString(formData, "currentPassword"),
    newPassword: getString(formData, "newPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await requireAuthUser("/app/perfil/editar");

  if (!user.email) {
    return {
      ok: false,
      message: "Sua conta não tem um e-mail válido para confirmar a senha atual.",
    };
  }

  const supabase = await createSupabaseServerClient();

  // O Supabase Auth não expõe uma checagem isolada de "senha atual" - a
  // forma real de confirmar é reautenticar com signInWithPassword. Se falhar,
  // a senha atual está errada; não simulamos essa verificação.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (reauthError) {
    return {
      ok: false,
      message: "Senha atual incorreta.",
      fieldErrors: { currentPassword: ["Senha atual incorreta."] },
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    return { ok: false, message: "Não foi possível atualizar sua senha agora." };
  }

  return { ok: true, message: "Senha atualizada com sucesso." };
}
