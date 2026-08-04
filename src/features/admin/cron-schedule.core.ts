/**
 * Espelha o schedule real do cron (vercel.json: "0 12 * * *" UTC = 09:00
 * BRT, 1x/dia - teto do plano Hobby da Vercel, documentado desde a rodada
 * de notificações). Nunca inventa uma frequência maior do que essa.
 */
const CRON_SCHEDULE_UTC_HOUR = 12;
const ATTENTION_THRESHOLD_HOURS = 26;
const CRITICAL_THRESHOLD_HOURS = 36;
const HOUR_MS = 60 * 60 * 1000;

export type CronHealthStatus = "saudavel" | "atencao" | "critico";

export function describeCronHealth(
  lastRunAt: string | null,
  now: Date = new Date(),
): { status: CronHealthStatus; label: string } {
  if (!lastRunAt) {
    return { status: "critico", label: "Nunca executado" };
  }

  const hoursSince = (now.getTime() - new Date(lastRunAt).getTime()) / HOUR_MS;

  if (hoursSince > CRITICAL_THRESHOLD_HOURS) {
    return { status: "critico", label: `Sem executar há ${Math.floor(hoursSince)}h` };
  }

  if (hoursSince > ATTENTION_THRESHOLD_HOURS) {
    return { status: "atencao", label: `Atrasado (última execução há ${Math.floor(hoursSince)}h)` };
  }

  return { status: "saudavel", label: "Dentro da janela esperada" };
}

/** Próxima execução esperada, com base só no schedule fixo - nunca uma previsão inventada. */
export function getNextExpectedCronRun(now: Date = new Date()): Date {
  const todayRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), CRON_SCHEDULE_UTC_HOUR, 0, 0));

  if (now.getTime() < todayRun.getTime()) {
    return todayRun;
  }

  return new Date(todayRun.getTime() + 24 * HOUR_MS);
}
