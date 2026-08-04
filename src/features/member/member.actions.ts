"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/server/services/auth-session.service";
import {
  getJourneyRpcClient,
  getSafeJourneyErrorMessage,
} from "@/server/services/journey-rpc.service";

export type MemberActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

const primaryGoalSchema = z.enum([
  "health",
  "discipline",
  "faith",
  "routine",
  "mind",
  "complete",
]);

const onboardingSchema = z.object({
  avatarUrl: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .pipe(z.url("Informe uma URL valida para a foto.").optional()),
  communicationOptIn: z.boolean(),
  displayName: z
    .string()
    .trim()
    .min(2, "Informe um nome de exibicao.")
    .max(80, "Use um nome de exibicao mais curto."),
  name: z.string().trim().min(2, "Informe seu nome.").max(120, "Use um nome mais curto."),
  primaryGoal: primaryGoalSchema,
  reminderTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horario valido."),
  timezone: z.string().trim().min(1, "Informe seu fuso horario."),
});

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function completeOnboardingAction(
  _previousState: MemberActionResult,
  formData: FormData,
): Promise<MemberActionResult> {
  const parsed = onboardingSchema.safeParse({
    avatarUrl: getString(formData, "avatarUrl"),
    communicationOptIn: getBoolean(formData, "communicationOptIn"),
    displayName: getString(formData, "displayName"),
    name: getString(formData, "name"),
    primaryGoal: getString(formData, "primaryGoal"),
    reminderTime: getString(formData, "reminderTime"),
    timezone: getString(formData, "timezone"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Revise os campos antes de continuar.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const user = await requireAuthUser("/app/onboarding");
  const supabase = await createSupabaseServerClient();
  const metadata: Record<string, unknown> = {
    ...asRecord(user.user_metadata),
    display_name: parsed.data.displayName,
    name: parsed.data.name,
    primary_goal: parsed.data.primaryGoal,
  };

  if (parsed.data.avatarUrl) {
    metadata.avatar_url = parsed.data.avatarUrl;
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: metadata,
  });

  if (metadataError) {
    return {
      ok: false,
      message: "Nao foi possivel salvar seu onboarding agora.",
    };
  }

  let admin;

  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      message:
        "A configuracao segura do servidor ainda nao permite concluir o onboarding.",
    };
  }

  const { data: preferences } = await admin
    .from("user_preferences")
    .select("notifications")
    .eq("user_id", user.id)
    .maybeSingle();

  // Lembrete diario prometido no onboarding (Correções obrigatórias
  // pré-lançamento, Parte B) - reminderTime e obrigatorio no schema acima
  // (sempre um horario valido, nunca inventado: o usuario sempre escolheu
  // ou aceitou o padrao do formulario), entao liga o mesmo par
  // daily_reminder_enabled + reminder_time que
  // saveNotificationPreferencesAction (notification-preferences.actions.ts)
  // ja usa como fonte de verdade - nenhum campo novo, nenhuma segunda
  // fonte. push_enabled deliberadamente NAO e tocado aqui (permanece
  // ausente/false ate o usuario ativar push explicitamente depois).
  const notifications = {
    ...asRecord(preferences?.notifications),
    communication_opt_in: parsed.data.communicationOptIn,
    daily_reminder_enabled: Boolean(parsed.data.reminderTime),
    email: parsed.data.communicationOptIn,
    in_app: true,
  };

  const { error: profileError } = await admin
    .from("users")
    .update({
      avatar_url: parsed.data.avatarUrl ?? null,
      display_name: parsed.data.displayName,
      name: parsed.data.name,
      onboarding_completed: true,
      timezone: parsed.data.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return {
      ok: false,
      message: "Nao foi possivel atualizar seu perfil agora.",
    };
  }

  const { error: preferencesError } = await admin.from("user_preferences").upsert({
    notifications,
    reminder_time: parsed.data.reminderTime,
    theme: "dark",
    user_id: user.id,
  });

  if (preferencesError) {
    return {
      ok: false,
      message: "Nao foi possivel salvar suas preferencias agora.",
    };
  }

  redirect("/app/dashboard");
}

export async function joinAvailableChallengeAction() {
  await requireAuthUser("/app/hoje");

  const supabase = await createSupabaseServerClient();
  const rpc = getJourneyRpcClient(supabase);
  const { error } = await rpc.rpc("join_available_challenge");

  if (error) {
    console.error(
      `[journey-rpc-failed] join_available_challenge code=${error.code ?? "unknown"}: ${error.message}`,
    );
    const message = encodeURIComponent(getSafeJourneyErrorMessage(error));
    redirect(`/app/hoje?journey=error&message=${message}`);
  }

  redirect("/app/hoje?journey=joined");
}
