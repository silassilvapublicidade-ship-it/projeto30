/**
 * SPEC ONLY - NÃO EXECUTA EM PRODUÇÃO.
 *
 * Este arquivo documenta a lógica original de cálculo de streak (sequência
 * de dias válidos), que foi a implementação real antes da rotina de
 * finalização do dia migrar para SQL (`finalize_daily_log_with_responses`,
 * ver supabase/migrations). A regra SQL é hoje a única fonte de verdade
 * para streak - este arquivo nunca é importado por nenhum código em src/,
 * não é parte do build, e existe só como referência histórica legível do
 * algoritmo original em TypeScript.
 *
 * Movido para fora de src/ na rodada de consolidação (Parte G) após
 * confirmar, por busca exaustiva de importadores, zero consumidores em
 * produção (só era usado por seu próprio teste e por um teste de
 * integração legado, ambos removidos junto com esta mudança).
 *
 * Não alterar regras de streak a partir deste arquivo - qualquer mudança
 * real de streak deve ser feita na migration SQL correspondente.
 */

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 86_400_000;

export type StreakInput = {
  previousCurrent: number;
  previousBest: number;
  lastValidLogDate: string | null;
  logDate: string;
  dayQualifies: boolean;
};

export type StreakResult = {
  current: number;
  best: number;
  extended: boolean;
  broken: boolean;
};

function parseDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) {
    throw new Error(`Data inválida: ${value}. Use YYYY-MM-DD.`);
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Data inválida: ${value}.`);
  }

  return Date.UTC(year, month - 1, day);
}

function daysBetween(previous: string, current: string) {
  return Math.round(
    (parseDateOnly(current) - parseDateOnly(previous)) / millisecondsPerDay,
  );
}

export function calculateStreak(input: StreakInput): StreakResult {
  if (!Number.isInteger(input.previousCurrent) || input.previousCurrent < 0) {
    throw new Error("previousCurrent precisa ser um inteiro não negativo.");
  }

  if (!Number.isInteger(input.previousBest) || input.previousBest < 0) {
    throw new Error("previousBest precisa ser um inteiro não negativo.");
  }

  if (!input.dayQualifies) {
    return {
      current: 0,
      best: input.previousBest,
      broken: input.previousCurrent > 0,
      extended: false,
    };
  }

  if (!input.lastValidLogDate) {
    return {
      current: 1,
      best: Math.max(input.previousBest, 1),
      broken: false,
      extended: true,
    };
  }

  const gap = daysBetween(input.lastValidLogDate, input.logDate);

  if (gap === 0) {
    return {
      current: input.previousCurrent,
      best: input.previousBest,
      broken: false,
      extended: false,
    };
  }

  const current = gap === 1 ? input.previousCurrent + 1 : 1;

  return {
    current,
    best: Math.max(input.previousBest, current),
    broken: gap > 1 && input.previousCurrent > 0,
    extended: true,
  };
}
