"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { sendChallengeLaunchStepTestNotification } from "@/server/services/notification-automations.service";

import { challengeIdParamSchema } from "./challenge-editor.schemas";
import { launchCampaignStepFormSchema, launchCampaignStepTestFormSchema } from "./launch-campaign.schemas";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

function editorPath(challengeId: string) {
  return `/admin/desafios/${challengeId}/editar`;
}

/**
 * Direct table upsert (RLS: "Admins can manage launch campaign config",
 * migration 0092) - mesmo padrao de upsertHabitNotificationConfigAction, sem
 * RPC porque nao ha validacao cross-tabela alem do zod. unique(challenge_id,
 * step_key) garante uma linha por step, entao isto cria e edita conforme ja
 * exista ou nao.
 */
export async function upsertChallengeLaunchCampaignStepAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));

  const parsed = launchCampaignStepFormSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    message: getFormValue(formData, "message") ?? "",
    sendTime: getFormValue(formData, "sendTime") ?? "09:00",
    stepKey: getFormValue(formData, "stepKey"),
    title: getFormValue(formData, "title") ?? "",
  });

  if (!parsed.success) {
    redirect(`${editorPath(challengeId)}?feedback=launch-campaign-invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("challenge_launch_campaign_steps").update(
    {
      enabled: parsed.data.enabled,
      message: parsed.data.message,
      send_time: parsed.data.sendTime,
      title: parsed.data.title,
    },
  )
    .eq("challenge_id", challengeId)
    .eq("step_key", parsed.data.stepKey);

  if (error) {
    redirect(`${editorPath(challengeId)}?feedback=launch-campaign-error`);
  }

  redirect(`${editorPath(challengeId)}?feedback=launch-campaign-saved`);
}

/**
 * Botao "Testar em uma conta" - resolve o e-mail para um user_id real e
 * dispara pelo motor real (sendChallengeLaunchStepTestNotification), nunca
 * um preview simulado. So funciona se o step ja foi salvo (le titulo/
 * mensagem persistidos, nunca o que estiver so digitado e nao salvo no
 * formulario ao lado).
 */
export async function sendChallengeLaunchStepTestAction(formData: FormData) {
  await requireAdminUser();

  const challengeId = challengeIdParamSchema.parse(formData.get("challengeId"));

  const parsed = launchCampaignStepTestFormSchema.safeParse({
    email: getFormValue(formData, "email"),
    stepKey: getFormValue(formData, "stepKey"),
  });

  if (!parsed.success) {
    redirect(`${editorPath(challengeId)}?feedback=launch-campaign-test-invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: testUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (!testUser) {
    redirect(`${editorPath(challengeId)}?feedback=launch-campaign-test-user-not-found`);
  }

  const sent = await sendChallengeLaunchStepTestNotification({
    challengeId,
    stepKey: parsed.data.stepKey,
    testUserId: testUser.id,
  });

  redirect(
    `${editorPath(challengeId)}?feedback=${sent ? "launch-campaign-test-sent" : "launch-campaign-test-error"}`,
  );
}
