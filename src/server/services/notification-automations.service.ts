import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { dispatchCampaignToAudience } from "./notification-dispatch.service";
import { logRpcFailure } from "./rpc-logging.service";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Creates the automation's campaign row on first sight of a given
 * idempotency key (source='automation', status='processing' from birth -
 * automations skip the draft/review lifecycle admin campaigns go through)
 * or reuses the existing one on every later call with the same key. This is
 * the only place automation-sourced notification_campaigns rows are ever
 * created - every automation below goes through it, so there is exactly one
 * engine (this file + notification-dispatch.service.ts), never a parallel
 * send path.
 */
async function getOrCreateAutomationCampaign(
  supabase: AdminClient,
  input: {
    actionLabel?: string | null;
    audienceType: string;
    automationType: string;
    challengeId?: string | null;
    destinationReferenceId?: string | null;
    destinationType: string;
    idempotencyKey: string;
    imageUrl?: string | null;
    message: string;
    title: string;
  },
): Promise<string | null> {
  await supabase
    .from("notification_campaigns")
    .upsert(
      {
        action_label: input.actionLabel ?? null,
        audience_type: input.audienceType,
        automation_type: input.automationType,
        channel_internal: true,
        channel_push: true,
        challenge_id: input.challengeId ?? null,
        destination_reference_id: input.destinationReferenceId ?? null,
        destination_type: input.destinationType,
        idempotency_key: input.idempotencyKey,
        image_url: input.imageUrl ?? null,
        message: input.message,
        source: "automation",
        started_at: new Date().toISOString(),
        status: "processing",
        title: input.title,
      },
      { ignoreDuplicates: true, onConflict: "idempotency_key" },
    );

  const { data, error } = await supabase
    .from("notification_campaigns")
    .select("id")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (error || !data) {
    logRpcFailure(`getOrCreateAutomationCampaign(${input.automationType})`, error ?? { message: "not found" });
    return null;
  }

  return data.id;
}

function todayReferenceDate(): string {
  // Same reference timezone the SQL resolvers use for cycle-level dates
  // (challenge start/end) - see migration 0048's own comment on why this is
  // deliberately not per-user timezone for these particular automations.
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Lembrete diario (07:00-22:00, por fuso do usuario) - uma campanha por
 * data local distinta observada entre os usuarios elegiveis no momento da
 * chamada, nunca uma por usuario (evitaria centenas de campanhas por dia). */
export async function runDailyReminderAutomation(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.rpc("automation_resolve_daily_reminder_audience");

  if (error || !rows) {
    logRpcFailure("automation_resolve_daily_reminder_audience", error ?? { message: "no rows" });
    return;
  }

  const byLocalDate = new Map<string, { push_eligible: boolean; user_id: string }[]>();
  for (const row of rows) {
    const list = byLocalDate.get(row.local_date) ?? [];
    list.push({ push_eligible: row.push_eligible, user_id: row.user_id });
    byLocalDate.set(row.local_date, list);
  }

  for (const [localDate, audience] of byLocalDate) {
    const campaignId = await getOrCreateAutomationCampaign(supabase, {
      audienceType: "automation_daily_reminder",
      automationType: "daily_reminder",
      destinationType: "hoje",
      idempotencyKey: `daily_reminder:${localDate}`,
      message: "Ainda dá tempo de finalizar o seu dia de hoje. Um pequeno passo já conta.",
      title: "Não esqueça do seu dia",
    });

    if (campaignId) {
      await dispatchCampaignToAudience(campaignId, audience);
    }
  }
}

async function runChallengeDateAutomation(input: {
  automationType: string;
  daysOffset: number;
  destinationType: "desafio";
  messageTemplate: (challengeName: string) => string;
  titleTemplate: (challengeName: string) => string;
  useStartDate: boolean;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.rpc("automation_resolve_challenge_date_audience", {
    p_days_offset: input.daysOffset,
    p_use_start_date: input.useStartDate,
  });

  if (error || !rows) {
    logRpcFailure("automation_resolve_challenge_date_audience", error ?? { message: "no rows" });
    return;
  }

  const byChallenge = new Map<
    string,
    { audience: { push_eligible: boolean; user_id: string }[]; challengeName: string }
  >();

  for (const row of rows) {
    const entry = byChallenge.get(row.challenge_id) ?? { audience: [], challengeName: row.challenge_name };
    entry.audience.push({ push_eligible: row.push_eligible, user_id: row.user_id });
    byChallenge.set(row.challenge_id, entry);
  }

  const referenceDate = todayReferenceDate();

  for (const [challengeId, { audience, challengeName }] of byChallenge) {
    const campaignId = await getOrCreateAutomationCampaign(supabase, {
      audienceType:
        input.automationType === "challenge_ending_soon"
          ? "automation_challenge_ending_soon"
          : input.useStartDate
            ? input.daysOffset === 0
              ? "automation_challenge_starting_today"
              : "automation_challenge_starting_tomorrow"
            : "automation_challenge_ending_soon",
      automationType: input.automationType,
      challengeId,
      destinationReferenceId: challengeId,
      destinationType: input.destinationType,
      idempotencyKey: `${input.automationType}:${challengeId}:${referenceDate}`,
      message: input.messageTemplate(challengeName),
      title: input.titleTemplate(challengeName),
    });

    if (campaignId) {
      await dispatchCampaignToAudience(campaignId, audience);
    }
  }
}

export async function runChallengeStartingTomorrowAutomation(): Promise<void> {
  await runChallengeDateAutomation({
    automationType: "challenge_starting_tomorrow",
    daysOffset: 1,
    destinationType: "desafio",
    messageTemplate: (name) => `O desafio "${name}" começa amanhã. Prepare-se!`,
    titleTemplate: () => "Seu desafio começa amanhã",
    useStartDate: true,
  });
}

export async function runChallengeStartingTodayAutomation(): Promise<void> {
  await runChallengeDateAutomation({
    automationType: "challenge_starting_today",
    daysOffset: 0,
    destinationType: "desafio",
    messageTemplate: (name) => `O desafio "${name}" começa hoje. Bora começar!`,
    titleTemplate: () => "Seu desafio começa hoje",
    useStartDate: true,
  });
}

export async function runChallengeEndingSoonAutomation(): Promise<void> {
  await runChallengeDateAutomation({
    automationType: "challenge_ending_soon",
    daysOffset: 3,
    destinationType: "desafio",
    messageTemplate: (name) => `Faltam 3 dias para o fim do desafio "${name}". Continue firme até o final!`,
    titleTemplate: () => "Seu desafio está terminando",
    useStartDate: false,
  });
}

export async function runInactiveUserAutomation(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.rpc("automation_resolve_inactive_users_audience", {
    p_inactive_days: 3,
  });

  if (error || !rows || rows.length === 0) {
    if (error) logRpcFailure("automation_resolve_inactive_users_audience", error);
    return;
  }

  const campaignId = await getOrCreateAutomationCampaign(supabase, {
    audienceType: "automation_inactive_user",
    automationType: "user_inactive_3_days",
    destinationType: "hoje",
    idempotencyKey: `user_inactive_3_days:${todayReferenceDate()}`,
    message: "Sentimos sua falta por aqui. Que tal retomar hoje, no seu ritmo?",
    title: "Vamos retomar sua jornada?",
  });

  if (campaignId) {
    await dispatchCampaignToAudience(campaignId, rows);
  }
}

/**
 * Called from publishTipAction (admin-tips.actions.ts) only when the admin
 * explicitly checks "avisar usuários" at publish time - never for
 * drafts/unpublish/re-publish without a fresh confirmation, per the
 * briefing. Does not touch anything in the Dicas feature itself beyond this
 * one call site.
 */
export async function runNewTipPublishedAutomation(input: {
  publishedAt: string;
  tipId: string;
  tipSlug: string;
  tipTitle: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.rpc("automation_resolve_new_tip_subscribers_audience");

  if (error || !rows) {
    logRpcFailure("automation_resolve_new_tip_subscribers_audience", error ?? { message: "no rows" });
    return;
  }

  // Keyed by (tip, publish timestamp) rather than just the tip id - a
  // genuine re-publish (unpublish, then publish again with the checkbox
  // re-checked) gets a fresh publishedAt and is therefore allowed to notify
  // again, while retries of the SAME publish action stay idempotent.
  const campaignId = await getOrCreateAutomationCampaign(supabase, {
    audienceType: "automation_new_tip",
    automationType: "new_tip_published",
    destinationReferenceId: input.tipSlug,
    destinationType: "dica",
    idempotencyKey: `new_tip_published:${input.tipId}:${input.publishedAt}`,
    message: `Nova dica publicada: "${input.tipTitle}".`,
    title: "Nova dica disponível",
  });

  if (campaignId) {
    await dispatchCampaignToAudience(campaignId, rows);
  }
}

/**
 * Called right after a user_achievements row is inserted (the achievement
 * engine itself is never modified - see journey.actions.ts's call site).
 * Never duplicates on retry: the idempotency_key is the user_achievement id
 * itself, so re-triggering the same unlock event is a guaranteed no-op.
 */
export async function runAchievementUnlockedAutomation(input: {
  achievementName: string;
  userAchievementId: string;
  userId: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.rpc("automation_resolve_specific_users_audience", {
    p_user_ids: [input.userId],
  });

  if (error || !rows || rows.length === 0) {
    if (error) logRpcFailure("automation_resolve_specific_users_audience", error);
    return;
  }

  const campaignId = await getOrCreateAutomationCampaign(supabase, {
    audienceType: "automation_achievement_unlocked",
    automationType: "achievement_unlocked",
    destinationType: "conquistas",
    idempotencyKey: `achievement_unlocked:${input.userAchievementId}`,
    message: `Você desbloqueou a conquista "${input.achievementName}". Parabéns!`,
    title: "Nova conquista desbloqueada",
  });

  if (campaignId) {
    await dispatchCampaignToAudience(campaignId, rows);
  }
}

/** Runs every date-driven automation once - called by the cron route, never
 * by a user request. Event-driven automations (new tip, achievement) are
 * NOT here - they run from their own trigger point instead. */
export async function runAllScheduledAutomations(): Promise<void> {
  await runDailyReminderAutomation();
  await runChallengeStartingTomorrowAutomation();
  await runChallengeStartingTodayAutomation();
  await runChallengeEndingSoonAutomation();
  await runInactiveUserAutomation();
}
