"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getTestChallengePurgePreview,
  type TestChallengePurgePreview,
} from "@/server/services/admin-analytics.service";
import { requireAdminUser } from "@/server/services/admin-session.service";

import { challengeIdSchema } from "./admin-analytics.schemas";
import { validateChallengeForPublish } from "./challenge-editor.core";

type StatusTransition = {
  from: readonly string[];
  to: string;
};

const transitions = {
  // "active" was added alongside the admin actions-menu refactor: the menu
  // now offers Arquivar directly from an active challenge (no longer
  // requiring Despublicar first), matching the per-status action set the
  // dropdown menu exposes.
  archive: { from: ["draft", "paused", "ended", "active"], to: "archived" },
  publish: { from: ["draft"], to: "active" },
  unpublish: { from: ["active"], to: "draft" },
} as const satisfies Record<string, StatusTransition>;

function resolveRedirectTarget(formData: FormData) {
  const value = formData.get("redirectTo");
  const target = typeof value === "string" && value.startsWith("/admin/") ? value : "/admin/desafios";
  const separator = target.includes("?") ? "&" : "?";

  return { separator, target };
}

async function transitionChallengeStatus(
  formData: FormData,
  action: keyof typeof transitions,
) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const parsedId = challengeIdSchema.safeParse(formData.get("challengeId"));

  if (!parsedId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const transition = transitions[action];

  const { error } = await supabase
    .from("challenges")
    .update({ status: transition.to as "active" | "archived" | "draft" })
    .eq("id", parsedId.data)
    .in("status", transition.from);

  if (error) {
    redirect(`${target}${separator}feedback=error`);
  }

  redirect(`${target}${separator}feedback=${action}-success`);
}

export async function publishChallengeAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const parsedId = challengeIdSchema.safeParse(formData.get("challengeId"));

  if (!parsedId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  // Revalida tudo de novo no servidor antes de publicar - nunca confia em
  // um estado "parece valido" calculado no cliente (ver
  // validateChallengeForPublish em challenge-editor.core.ts).
  const supabase = await createSupabaseServerClient();
  const [{ data: challenge }, { count: habitsCount }, { count: daysCount }] = await Promise.all([
    supabase
      .from("challenges")
      .select("duration_days, name, slug")
      .eq("id", parsedId.data)
      .maybeSingle(),
    supabase
      .from("habits")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", parsedId.data)
      .eq("active", true),
    supabase
      .from("challenge_days")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", parsedId.data),
  ]);

  if (!challenge) {
    redirect(`${target}${separator}feedback=error`);
  }

  const issues = validateChallengeForPublish({
    durationDays: challenge.duration_days,
    generatedDaysCount: daysCount ?? 0,
    habitsCount: habitsCount ?? 0,
    name: challenge.name,
    slug: challenge.slug,
  });

  if (issues.length > 0) {
    redirect(`${target}${separator}feedback=validation-failed`);
  }

  await transitionChallengeStatus(formData, "publish");
}

export async function unpublishChallengeAction(formData: FormData) {
  await transitionChallengeStatus(formData, "unpublish");
}

export async function archiveChallengeAction(formData: FormData) {
  await transitionChallengeStatus(formData, "archive");
}

/**
 * Physical deletion, only for challenges with zero participants. Relies on
 * challenge_enrollments.challenge_id being ON DELETE RESTRICT (0001) to make
 * this safe even under a race: if an enrollment slipped in between the admin
 * loading the list and clicking Excluir, Postgres rejects the delete with
 * 23503 instead of silently cascading away real user history. A challenge
 * with any history must be archived instead - never deleted.
 */
export async function deleteChallengeAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const parsedId = challengeIdSchema.safeParse(formData.get("challengeId"));

  if (!parsedId.success) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("challenges").delete().eq("id", parsedId.data);

  if (error) {
    const feedback = error.code === "23503" ? "delete-blocked" : "error";
    redirect(`${target}${separator}feedback=${feedback}`);
  }

  redirect(`${target}${separator}feedback=delete-success`);
}

/**
 * Permanent purge of a challenge explicitly marked is_test = true, even if
 * it has enrollment/log history (deleteChallengeAction above never allows
 * that - it relies on the FK restrict and always blocks on 23503). All
 * authorization and validation (super_admin, is_test, exact name, exact
 * phrase) happens inside admin_delete_test_challenge_permanently() itself;
 * this action never trusts the client beyond forwarding what was typed.
 */
export async function purgeTestChallengeAction(formData: FormData) {
  await requireAdminUser();

  const { separator, target } = resolveRedirectTarget(formData);
  const parsedId = challengeIdSchema.safeParse(formData.get("challengeId"));
  const confirmationName = formData.get("confirmationName");
  const confirmationPhrase = formData.get("confirmationPhrase");

  if (
    !parsedId.success ||
    typeof confirmationName !== "string" ||
    typeof confirmationPhrase !== "string"
  ) {
    redirect(`${target}${separator}feedback=invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_delete_test_challenge_permanently", {
    target_challenge_id: parsedId.data,
    confirmation_name: confirmationName,
    confirmation_phrase: confirmationPhrase,
  });

  if (error) {
    const feedback =
      error.code === "42501"
        ? "purge-forbidden"
        : error.code === "P0002" || error.code === "P0003"
          ? "purge-blocked"
          : "error";
    redirect(`${target}${separator}feedback=${feedback}`);
  }

  redirect(`${target}${separator}feedback=purge-success`);
}

export type PurgePreviewResult =
  | { ok: true; preview: TestChallengePurgePreview }
  | { ok: false; message: string };

/**
 * Callable directly from the client (PurgeTestChallengeDialog) when the
 * modal opens, so the admin sees real, server-computed counts before typing
 * the confirmation phrase - never numbers derived from the already-rendered
 * admin list row.
 */
export async function getTestChallengePurgePreviewAction(
  challengeId: string,
): Promise<PurgePreviewResult> {
  await requireAdminUser();

  const parsedId = challengeIdSchema.safeParse(challengeId);

  if (!parsedId.success) {
    return { ok: false, message: "Identificador de desafio inválido." };
  }

  const { data, error } = await getTestChallengePurgePreview(parsedId.data);

  if (error || !data) {
    return { ok: false, message: error ?? "Não foi possível carregar a prévia." };
  }

  return { ok: true, preview: data };
}
