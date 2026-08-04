/**
 * Espelha o schedule real do cron (vercel.json: "0 12 * * *" UTC = 09:00
 * BRT, 1x/dia - teto do plano Hobby da Vercel, documentado desde a rodada
 * de notificações). Nunca inventa uma frequência maior do que essa.
 */
const CRON_SCHEDULE_UTC_HOUR = 12;
const HOUR_MS = 60 * 60 * 1000;

export type CronHealthStatus = "saudavel" | "atencao" | "critico";

export type CronEvidenceInput = {
  cronHasRecentEvidence: boolean;
  overdueScheduledCampaigns: number;
};

/**
 * A severidade em si NUNCA é recalculada aqui - vem pronta do servidor
 * (admin_get_system_health_overview, migration 0075) via
 * cronHasRecentEvidence/overdueScheduledCampaigns. Esta função só traduz
 * esses dois fatos já decididos pelo banco num rótulo de 3 níveis para o
 * card do cron - a mesma regra, nunca uma segunda regra.
 */
export function describeCronHealth(input: CronEvidenceInput): { status: CronHealthStatus; label: string } {
  if (!input.cronHasRecentEvidence && input.overdueScheduledCampaigns > 0) {
    return { status: "critico", label: `${input.overdueScheduledCampaigns} campanha(s) pendente(s) sem processar` };
  }

  if (!input.cronHasRecentEvidence) {
    return { status: "atencao", label: "Aguardando confirmação" };
  }

  return { status: "saudavel", label: "Dentro da janela esperada" };
}

/**
 * Rótulo humano da última evidência de atividade (Parte A.3: nunca "nunca
 * rodou" quando a telemetria é só mais nova que a última janela do cron).
 * lastCronRun = evidência direta (system_error_events). Sem essa,
 * lastAutomationActivityAt é a evidência de fallback (campanha real já
 * disparada por automação) - também real, nunca fabricada.
 */
export function describeCronEvidenceLabel(
  input: { lastCronRun: { lastSeenAt: string } | null; lastAutomationActivityAt: string | null },
  now: Date = new Date(),
): string {
  if (input.lastCronRun) {
    return `Confirmado ${formatRelativeHours(input.lastCronRun.lastSeenAt, now)}`;
  }

  if (input.lastAutomationActivityAt) {
    return `Atividade automática ${formatRelativeHours(input.lastAutomationActivityAt, now)} (rodada ainda não confirmada diretamente)`;
  }

  return "Aguardando primeira execução";
}

function formatRelativeHours(iso: string, now: Date): string {
  const hours = Math.floor((now.getTime() - new Date(iso).getTime()) / HOUR_MS);

  if (hours < 1) return "há poucos minutos";
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

/** Próxima execução esperada, com base só no schedule fixo - nunca uma previsão inventada. */
export function getNextExpectedCronRun(now: Date = new Date()): Date {
  const todayRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CRON_SCHEDULE_UTC_HOUR, 0, 0));

  if (now.getTime() < todayRun.getTime()) {
    return todayRun;
  }

  return new Date(todayRun.getTime() + 24 * HOUR_MS);
}
