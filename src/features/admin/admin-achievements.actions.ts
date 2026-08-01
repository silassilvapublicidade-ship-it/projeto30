"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  achievementErrorMessage,
  getAdminAchievementDeletePreview,
  type AdminAchievementDeletePreview,
} from "@/server/services/admin-achievements.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

import {
  achievementCreateSchema,
  achievementIdSchema,
  achievementUpdateSchema,
  getAchievementRuleDefinition,
} from "./admin-achievements.schemas";

export type AdminAchievementActionResult =
  | { fieldErrors?: Record<string, string[]>; message: string; ok: false }
  | { achievementId?: string; message: string; ok: true };

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function revalidateAchievementPaths(achievementId?: string) {
  revalidatePath("/admin/conquistas");
  if (achievementId) {
    revalidatePath(`/admin/conquistas/${achievementId}/editar`);
  }
}

/**
 * slug + rule_config are derived entirely from the chosen ruleType (one of
 * the 10 fixed entries in ACHIEVEMENT_RULE_TYPES) - never accepted as free
 * text/JSON from the client. A 23505 here means the challenge already has an
 * achievement of this rule type (achievements_scope_slug_unique).
 */
export async function createAchievementAction(
  _previousState: AdminAchievementActionResult,
  formData: FormData,
): Promise<AdminAchievementActionResult> {
  await requireAdminUser();

  const parsed = achievementCreateSchema.safeParse({
    category: getFormValue(formData, "category"),
    challengeId: getFormValue(formData, "challengeId"),
    description: getFormValue(formData, "description"),
    icon: getFormValue(formData, "icon"),
    name: getFormValue(formData, "name") ?? "",
    pointsBonus: getFormValue(formData, "pointsBonus") ?? "0",
    rarity: getFormValue(formData, "rarity"),
    ruleType: getFormValue(formData, "ruleType"),
    shareMessage: getFormValue(formData, "shareMessage"),
    shareTitle: getFormValue(formData, "shareTitle"),
    sortOrder: getFormValue(formData, "sortOrder") ?? "0",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const ruleDefinition = getAchievementRuleDefinition(parsed.data.ruleType);

  if (!ruleDefinition) {
    return { ok: false, message: "Tipo de regra inválido." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("achievements")
    .insert({
      active: true,
      category: parsed.data.category ?? null,
      challenge_id: parsed.data.challengeId,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? ruleDefinition.defaultIcon,
      name: parsed.data.name,
      points_bonus: parsed.data.pointsBonus,
      rarity: parsed.data.rarity ?? null,
      rule_config: ruleDefinition.ruleConfig,
      share_message: parsed.data.shareMessage ?? null,
      share_title: parsed.data.shareTitle ?? null,
      slug: ruleDefinition.slug,
      sort_order: parsed.data.sortOrder,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, message: achievementErrorMessage(error) };
  }

  revalidateAchievementPaths(inserted.id);
  redirect(`/admin/conquistas/${inserted.id}/editar?feedback=create-success`);
}

/**
 * challenge_id, slug and rule_config are never editable after creation -
 * they define WHICH real unlock condition this row corresponds to, and
 * changing them post-hoc would desync already-granted user_achievements
 * from what the achievement claims to be.
 */
export async function updateAchievementAction(
  _previousState: AdminAchievementActionResult,
  formData: FormData,
): Promise<AdminAchievementActionResult> {
  await requireAdminUser();

  const achievementId = achievementIdSchema.safeParse(formData.get("achievementId"));

  if (!achievementId.success) {
    return { ok: false, message: "Identificador de conquista inválido." };
  }

  const parsed = achievementUpdateSchema.safeParse({
    active: formData.get("active") === "on",
    category: getFormValue(formData, "category"),
    description: getFormValue(formData, "description"),
    icon: getFormValue(formData, "icon"),
    name: getFormValue(formData, "name") ?? "",
    pointsBonus: getFormValue(formData, "pointsBonus") ?? "0",
    rarity: getFormValue(formData, "rarity"),
    shareMessage: getFormValue(formData, "shareMessage"),
    shareTitle: getFormValue(formData, "shareTitle"),
    sortOrder: getFormValue(formData, "sortOrder") ?? "0",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("achievements")
    .update({
      active: parsed.data.active,
      category: parsed.data.category ?? null,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon ?? null,
      name: parsed.data.name,
      points_bonus: parsed.data.pointsBonus,
      rarity: parsed.data.rarity ?? null,
      share_message: parsed.data.shareMessage ?? null,
      share_title: parsed.data.shareTitle ?? null,
      sort_order: parsed.data.sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", achievementId.data);

  if (error) {
    return { ok: false, message: achievementErrorMessage(error) };
  }

  revalidateAchievementPaths(achievementId.data);
  return { ok: true, message: "Conquista salva." };
}

export type DeletePreviewResult =
  | { ok: true; preview: AdminAchievementDeletePreview }
  | { ok: false; message: string };

/**
 * Callable directly from the client (delete confirmation dialog) so the
 * admin sees the real, server-computed unlock count before the delete
 * button is even enabled - never a number derived from the already-rendered
 * list row.
 */
export async function getAchievementDeletePreviewAction(
  achievementId: string,
): Promise<DeletePreviewResult> {
  await requireAdminUser();

  const parsedId = achievementIdSchema.safeParse(achievementId);

  if (!parsedId.success) {
    return { ok: false, message: "Identificador de conquista inválido." };
  }

  const { data, error } = await getAdminAchievementDeletePreview(parsedId.data);

  if (error || !data) {
    return { ok: false, message: error ?? "Não foi possível carregar a prévia." };
  }

  return { ok: true, preview: data };
}

/**
 * The RPC re-validates unlocked_count = 0 server-side regardless of what the
 * preview showed - this action never trusts the client beyond forwarding
 * the id. An achievement that's already been unlocked by someone can only be
 * disabled (updateAchievementAction, active = false), never deleted.
 */
export async function deleteAchievementAction(formData: FormData) {
  await requireAdminUser();

  const achievementId = achievementIdSchema.safeParse(formData.get("achievementId"));

  if (!achievementId.success) {
    redirect("/admin/conquistas?feedback=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_delete_achievement", {
    p_achievement_id: achievementId.data,
  });

  if (error) {
    const feedback = error.code === "P0003" ? "delete-blocked" : "error";
    redirect(`/admin/conquistas?feedback=${feedback}`);
  }

  revalidateAchievementPaths();
  redirect("/admin/conquistas?feedback=delete-success");
}
