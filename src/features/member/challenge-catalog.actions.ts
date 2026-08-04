"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapPostgresCodeToSeverity } from "@/features/observability/system-error.core";
import { recordAnalyticsEvent } from "@/server/services/analytics.service";
import { requireAuthUser } from "@/server/services/auth-session.service";
import { recordSystemError } from "@/server/services/system-observability.service";

import { challengeIdSchema } from "./challenge-catalog.schemas";

function getSafeErrorMessage(error: { code?: string; message: string } | null) {
  if (!error) {
    return "Não foi possível concluir a inscrição agora.";
  }

  if (error.code === "42501") {
    return "Sua sessão precisa ser renovada antes de continuar.";
  }

  if (error.code === "P0002") {
    return "Este desafio não está disponível para inscrição agora.";
  }

  if (error.code === "P0006") {
    return "Você abandonou este desafio e não pode se inscrever novamente.";
  }

  return "Não foi possível concluir a inscrição agora. Tente novamente em instantes.";
}

export async function joinChallengeAction(formData: FormData) {
  const user = await requireAuthUser("/app/desafios");

  const parsedId = challengeIdSchema.safeParse(formData.get("challengeId"));
  const redirectSlug = formData.get("challengeSlug");
  const detailPath =
    typeof redirectSlug === "string" && redirectSlug
      ? `/app/desafios/${redirectSlug}`
      : "/app/desafios";

  if (!parsedId.success) {
    redirect(`${detailPath}?joinFeedback=invalid`);
  }

  await recordAnalyticsEvent({
    challengeId: parsedId.data,
    eventName: "challenge_join_clicked",
  });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("join_specific_challenge", {
    target_challenge_id: parsedId.data,
  });

  if (error) {
    await recordSystemError({
      area: "desafios",
      operation: "join_specific_challenge",
      severity: mapPostgresCodeToSeverity(error.code),
      message: "Falha ao inscrever o usuário no desafio.",
      postgresCode: error.code,
      userId: user.id,
    });

    const message = encodeURIComponent(getSafeErrorMessage(error));
    redirect(`${detailPath}?joinFeedback=error&joinMessage=${message}`);
  }

  redirect("/app/hoje?journey=joined");
}
