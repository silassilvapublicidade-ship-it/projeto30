"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";

import { challengeIdSchema } from "./admin-analytics.schemas";

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
  await transitionChallengeStatus(formData, "publish");
}

export async function unpublishChallengeAction(formData: FormData) {
  await transitionChallengeStatus(formData, "unpublish");
}

export async function archiveChallengeAction(formData: FormData) {
  await transitionChallengeStatus(formData, "archive");
}
