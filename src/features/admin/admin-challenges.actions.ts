"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

import { challengeIdSchema } from "./admin-analytics.schemas";
import { validateChallengeForPublish } from "./challenge-editor.core";

type StatusTransition = {
  from: readonly string[];
  to: string;
};

const transitions = {
  archive: { from: ["draft", "paused", "ended"], to: "archived" },
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
