"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapPostgresCodeToSeverity } from "@/features/observability/system-error.core";
import { requireAuthUser } from "@/server/services/auth-session.service";
import { recordSystemError } from "@/server/services/system-observability.service";

const enrollmentIdSchema = z.uuid("Identificador de inscrição inválido.");

function getSafeErrorMessage(error: { code?: string; message: string } | null) {
  if (!error) {
    return "Não foi possível abandonar o desafio agora.";
  }

  if (error.code === "42501") {
    return "Sua sessão precisa ser renovada antes de continuar.";
  }

  if (error.code === "P0002") {
    return "Esta inscrição não foi encontrada.";
  }

  if (error.code === "22023") {
    return "Este desafio não pode ser abandonado no estado atual.";
  }

  return "Não foi possível abandonar o desafio agora. Tente novamente em instantes.";
}

export async function abandonChallengeAction(formData: FormData) {
  const user = await requireAuthUser("/app/desafios");

  const parsedId = enrollmentIdSchema.safeParse(formData.get("enrollmentId"));

  if (!parsedId.success) {
    redirect("/app/desafios?abandonFeedback=invalid");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("abandon_challenge_enrollment", {
    target_enrollment_id: parsedId.data,
  });

  if (error) {
    await recordSystemError({
      area: "desafios",
      operation: "abandon_challenge_enrollment",
      severity: mapPostgresCodeToSeverity(error.code),
      message: "Falha ao abandonar a inscrição do usuário no desafio.",
      postgresCode: error.code,
      userId: user.id,
    });

    const message = encodeURIComponent(getSafeErrorMessage(error));
    redirect(`/app/desafios?abandonFeedback=error&abandonMessage=${message}`);
  }

  revalidatePath("/app/desafios");
  revalidatePath("/app/hoje");
  revalidatePath("/app/jornada");
  redirect("/app/desafios?abandonFeedback=success");
}
