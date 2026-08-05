import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

import { dispatchCampaignToAudience, type AudienceEntry } from "./notification-dispatch.service";
import { logRpcFailure } from "./rpc-logging.service";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type DailyMotivationMessageRow = Tables<"daily_motivation_messages">;

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

/**
 * Parte E - fecha o ciclo do Feedback. Chamada só a partir de
 * updateFeedbackAction (feedback-admin.actions.ts), que já decidiu QUAL
 * evento aconteceu (resposta nova, ou status virou planned/resolved) antes
 * de chegar aqui - esta função nunca decide isso sozinha, só despacha pelo
 * mesmo motor de sempre. O texto do push nunca inclui o conteúdo da
 * resposta (nem é passado para esta função) - só o aviso genérico. Chave de
 * idempotência por (feedback, evento) - reabrir/editar depois não reenvia o
 * mesmo aviso; mudanças de prioridade ou nota interna nunca chamam isto.
 */
export async function runFeedbackRespondedAutomation(input: {
  event: "responded" | "status_planned" | "status_resolved";
  feedbackId: string;
  userId: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase.rpc("automation_resolve_important_update_audience", {
    p_user_ids: [input.userId],
  });

  if (error || !rows || rows.length === 0) {
    if (error) logRpcFailure("automation_resolve_important_update_audience", error);
    return;
  }

  const copy: Record<typeof input.event, { message: string; title: string }> = {
    responded: { message: "Abra o Projeto 30 para acompanhar a resposta.", title: "Seu feedback recebeu uma resposta" },
    status_planned: { message: "Abra o Projeto 30 para acompanhar o andamento.", title: "Seu feedback foi planejado" },
    status_resolved: { message: "Abra o Projeto 30 para ver os detalhes.", title: "Seu feedback foi resolvido" },
  };

  const campaignId = await getOrCreateAutomationCampaign(supabase, {
    audienceType: "automation_feedback_response",
    automationType: `feedback_${input.event}`,
    destinationType: "feedback",
    idempotencyKey: `feedback_${input.event}:${input.feedbackId}`,
    message: copy[input.event].message,
    title: copy[input.event].title,
  });

  if (campaignId) {
    await dispatchCampaignToAudience(campaignId, rows);
  }
}

function toSaoPauloDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Picks today's daily motivation message (Parte 3: sorteio aleatorio entre
 * as ativas/elegiveis, nunca repetindo a do dia anterior). Stability across
 * multiple cron ticks in the same day - and the "never repeat consecutive
 * days" rule itself - both come from the same source of truth: the most
 * recent automation_type='daily_motivation' campaign row. If it was created
 * today, its stored message is reused unchanged; otherwise it's exactly
 * "yesterday's" message and gets excluded from today's draw. One message
 * rotates for the whole app per day (see the Modulo G summary's documented
 * design decision) - simpler than per-user history and still satisfies the
 * literal requirement since every user sees the same day's message.
 */
async function pickDailyMotivationMessage(
  supabase: AdminClient,
): Promise<DailyMotivationMessageRow | null> {
  const today = todayReferenceDate();

  const { data: lastCampaign } = await supabase
    .from("notification_campaigns")
    .select("created_at, destination_reference_id")
    .eq("automation_type", "daily_motivation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastMessageId = lastCampaign?.destination_reference_id ?? null;

  if (lastCampaign && lastMessageId && toSaoPauloDate(lastCampaign.created_at) === today) {
    const { data: reused } = await supabase
      .from("daily_motivation_messages")
      .select("*")
      .eq("id", lastMessageId)
      .maybeSingle();

    if (reused) {
      return reused;
    }
  }

  const { data: candidates } = await supabase.from("daily_motivation_messages").select("*").eq("active", true);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  const now = Date.now();
  const eligible = candidates.filter((message) => {
    if (message.starts_at && new Date(message.starts_at).getTime() > now) return false;
    if (message.ends_at && new Date(message.ends_at).getTime() < now) return false;
    return true;
  });

  if (eligible.length === 0) {
    return null;
  }

  const pool = eligible.length > 1 ? eligible.filter((message) => message.id !== lastMessageId) : eligible;
  const drawFrom = pool.length > 0 ? pool : eligible;

  return drawFrom[Math.floor(Math.random() * drawFrom.length)] ?? null;
}

/**
 * Motor inteligente (Parte 1/3/5/6/7/8): uma unica chamada RPC resolve, por
 * usuario, no maximo 1 notificacao vencedora entre todos os lembretes de
 * habito habilitados e a motivacao do dia (ja aplicando janela 07:00-22:00,
 * "so se ainda nao concluido", frequencia e o espacamento anti-spam de 60min
 * - toda a logica de selecao roda no banco, Parte 14). Aqui so agrupamos por
 * candidate_key e despachamos pelo MESMO motor de campanhas de sempre
 * (getOrCreateAutomationCampaign + dispatchCampaignToAudience) - nenhuma
 * fila paralela.
 */
export async function runSmartNotificationTick(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const today = todayReferenceDate();

  const dailyMotivationMessage = await pickDailyMotivationMessage(supabase);

  const { data: rows, error } = await supabase.rpc("automation_resolve_smart_notification_candidates", {
    p_daily_motivation_body: dailyMotivationMessage?.body ?? undefined,
    p_daily_motivation_category: dailyMotivationMessage?.category ?? undefined,
    p_daily_motivation_message_id: dailyMotivationMessage?.id ?? undefined,
    p_daily_motivation_title: dailyMotivationMessage?.title ?? undefined,
  });

  if (error || !rows) {
    logRpcFailure("automation_resolve_smart_notification_candidates", error ?? { message: "no rows" });
    return;
  }

  type CandidateRow = (typeof rows)[number];
  const byCandidateKey = new Map<string, { audience: AudienceEntry[]; sample: CandidateRow }>();

  for (const row of rows) {
    const entry = byCandidateKey.get(row.candidate_key) ?? { audience: [], sample: row };
    entry.audience.push({ push_eligible: row.push_eligible, user_id: row.user_id });
    byCandidateKey.set(row.candidate_key, entry);
  }

  for (const [candidateKey, { audience, sample }] of byCandidateKey) {
    const isMotivation = candidateKey === "motivation";

    const campaignId = await getOrCreateAutomationCampaign(supabase, {
      audienceType: isMotivation ? "automation_daily_motivation" : "automation_habit_reminder",
      automationType: isMotivation ? "daily_motivation" : "habit_reminder",
      destinationReferenceId: isMotivation ? (dailyMotivationMessage?.id ?? null) : (sample.habit_id ?? null),
      destinationType: sample.destination_type,
      idempotencyKey: isMotivation
        ? `daily_motivation:${today}`
        : `habit_reminder:${sample.habit_id}:${today}`,
      message: sample.notification_body ?? "",
      title: sample.notification_title ?? "",
    });

    if (campaignId) {
      await dispatchCampaignToAudience(campaignId, audience);
    }
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
  await runSmartNotificationTick();
}
