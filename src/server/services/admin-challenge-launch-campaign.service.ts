import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/database";

export const LAUNCH_CAMPAIGN_STEP_KEYS = [
  "seven_days_before",
  "three_days_before",
  "one_day_before",
  "launch_day",
  "launch_day_followup",
] as const;

export type LaunchCampaignStepKey = (typeof LAUNCH_CAMPAIGN_STEP_KEYS)[number];

/** days_offset e sempre relativo a challenges.start_date - nunca editavel
 * pelo admin (so titulo/mensagem/horario/ativado mudam por step). */
export const LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET: Record<LaunchCampaignStepKey, number> = {
  launch_day: 0,
  launch_day_followup: 0,
  one_day_before: -1,
  seven_days_before: -7,
  three_days_before: -3,
};

/** Conteudo padrao generico (nunca especifico de um desafio) - interpola o
 * nome do desafio, sempre criado desativado. O admin edita livremente
 * depois, mesmo padrao de seed-com-override do challenge_habit_notifications. */
export function defaultStepContent(challengeName: string, stepKey: LaunchCampaignStepKey): { message: string; title: string } {
  switch (stepKey) {
    case "seven_days_before":
      return {
        message: `Em breve começa ${challengeName}. Prepare-se para abrir espaço para uma nova jornada de 30 dias.`,
        title: "Um novo ciclo está chegando",
      };
    case "three_days_before":
      return {
        message: `Faltam 3 dias para ${challengeName} começar. Prepare-se.`,
        title: "Faltam 3 dias",
      };
    case "one_day_before":
      return {
        message: `Amanhã começa ${challengeName}. Organize sua rotina e prepare-se para um novo ciclo.`,
        title: "Amanhã começa",
      };
    case "launch_day":
      return {
        message: "Seu novo ciclo de 30 dias já está disponível.",
        title: `${challengeName} começou`,
      };
    case "launch_day_followup":
      return {
        message: "Seu primeiro passo ainda pode ser dado hoje.",
        title: `${challengeName} já começou`,
      };
  }
}

type AnyClient = SupabaseClient<Database>;
type LaunchCampaignStepRow = Tables<"challenge_launch_campaign_steps">;

/**
 * Le os 5 steps da campanha de lancamento de um desafio; se nenhum existir
 * ainda (primeira vez que o admin abre esta secao para este desafio), semeia
 * as 5 linhas com conteudo generico, todas enabled=false. Idempotente -
 * chamadas seguintes so leem, nunca resemeiam por cima de edicoes do admin.
 */
export async function getOrSeedChallengeLaunchCampaignSteps(
  supabase: AnyClient,
  challengeId: string,
  challengeName: string,
): Promise<LaunchCampaignStepRow[]> {
  const { data: existing } = await supabase
    .from("challenge_launch_campaign_steps")
    .select("*")
    .eq("challenge_id", challengeId);

  if (existing && existing.length > 0) {
    return existing.sort(
      (a, b) => LAUNCH_CAMPAIGN_STEP_KEYS.indexOf(a.step_key as LaunchCampaignStepKey)
        - LAUNCH_CAMPAIGN_STEP_KEYS.indexOf(b.step_key as LaunchCampaignStepKey),
    );
  }

  const seedRows = LAUNCH_CAMPAIGN_STEP_KEYS.map((stepKey) => {
    const content = defaultStepContent(challengeName, stepKey);
    return {
      challenge_id: challengeId,
      days_offset: LAUNCH_CAMPAIGN_STEP_DAYS_OFFSET[stepKey],
      enabled: false,
      message: content.message,
      step_key: stepKey,
      title: content.title,
    };
  });

  const { data: seeded } = await supabase
    .from("challenge_launch_campaign_steps")
    .upsert(seedRows, { ignoreDuplicates: true, onConflict: "challenge_id,step_key" })
    .select("*");

  if (seeded && seeded.length > 0) {
    return seeded.sort(
      (a, b) => LAUNCH_CAMPAIGN_STEP_KEYS.indexOf(a.step_key as LaunchCampaignStepKey)
        - LAUNCH_CAMPAIGN_STEP_KEYS.indexOf(b.step_key as LaunchCampaignStepKey),
    );
  }

  // Corrida rara (dois carregamentos concorrentes semeando ao mesmo tempo) -
  // o upsert com ignoreDuplicates pode retornar vazio; re-le o que ja existe.
  const { data: reread } = await supabase
    .from("challenge_launch_campaign_steps")
    .select("*")
    .eq("challenge_id", challengeId);

  return (reread ?? []).sort(
    (a, b) => LAUNCH_CAMPAIGN_STEP_KEYS.indexOf(a.step_key as LaunchCampaignStepKey)
      - LAUNCH_CAMPAIGN_STEP_KEYS.indexOf(b.step_key as LaunchCampaignStepKey),
  );
}

/** Data-alvo (America/Sao_Paulo) exibida no Admin para cada step - so
 * leitura, recalculada a cada carregamento a partir de start_date. */
export function computeLaunchCampaignStepTargetDate(
  startDate: string | null,
  daysOffset: number,
): string | null {
  if (!startDate) {
    return null;
  }

  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + daysOffset);
  return utcDate.toISOString().slice(0, 10);
}
