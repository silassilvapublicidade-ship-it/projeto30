/**
 * "Sua missao de hoje" (Dashboard como alma do app, Parte A) - toda a logica
 * de estado/mensagem em um unico lugar puro/testavel, igual ao padrao ja
 * usado em profile-evolution.core.ts. Nada aqui recalcula regra de negocio:
 * journeyState e todayProgress.state ja vem prontos de
 * member-area.service.ts (mesma fonte que Hoje usa) - este modulo so
 * traduz esse estado em titulo/CTA, nunca reimplementa a maquina de
 * estados.
 */

export type MissionStateKind =
  | "challenge_ended"
  | "challenge_not_started"
  | "challenge_paused"
  | "day_complete"
  | "day_finalized_partial"
  | "day_finalized_streak_maintained"
  | "day_in_progress"
  | "day_not_started";

export type MissionCta = { href: string; label: string } | null;

export type MissionStateDisplay = {
  cta: MissionCta;
  kind: MissionStateKind;
  title: string;
};

const CONTINUE_CTA: MissionCta = { href: "/app/hoje", label: "Continuar meu dia" };
const JOURNEY_CTA: MissionCta = { href: "/app/jornada", label: "Ver minha Jornada" };

function formatShortDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(parsed);
}

/**
 * 8 estados do briefing (Parte A item 4), derivados de journeyState +
 * todayProgress.state + completionPercent + streakMinimumCompletion - nunca
 * uma segunda maquina de estados, so uma traducao para copy/CTA. Nunca usa
 * linguagem de culpa.
 */
export function describeMissionState(input: {
  challengeStartDate: string | null;
  completionPercent: number;
  journeyState:
    | "cycle_ended"
    | "cycle_not_started"
    | "cycle_paused"
    | "day_available"
    | "day_finalized"
    | "error"
    | "no_active_cycle";
  streakMinimumCompletion: number;
  todayProgressState: "complete" | "finalized" | "in_progress" | "not_started" | "partial";
}): MissionStateDisplay {
  if (input.journeyState === "cycle_paused") {
    return { cta: null, kind: "challenge_paused", title: "Este desafio está pausado." };
  }

  if (input.journeyState === "cycle_ended") {
    return { cta: JOURNEY_CTA, kind: "challenge_ended", title: "Este ciclo foi encerrado." };
  }

  if (input.journeyState === "cycle_not_started") {
    return {
      cta: null,
      kind: "challenge_not_started",
      title: input.challengeStartDate
        ? `Este desafio começa em ${formatShortDate(input.challengeStartDate)}.`
        : "Este desafio ainda não começou.",
    };
  }

  if (input.todayProgressState === "finalized") {
    return input.completionPercent >= input.streakMinimumCompletion
      ? {
          cta: JOURNEY_CTA,
          kind: "day_finalized_streak_maintained",
          title: "Dia finalizado e sequência mantida.",
        }
      : { cta: JOURNEY_CTA, kind: "day_finalized_partial", title: "Dia finalizado. Cada ação contou." };
  }

  if (input.todayProgressState === "complete") {
    return {
      cta: CONTINUE_CTA,
      kind: "day_complete",
      title: "Você concluiu tudo que estava disponível hoje.",
    };
  }

  if (input.todayProgressState === "in_progress" || input.todayProgressState === "partial") {
    return { cta: CONTINUE_CTA, kind: "day_in_progress", title: "Você já avançou hoje." };
  }

  return { cta: CONTINUE_CTA, kind: "day_not_started", title: "Seu dia está pronto para começar." };
}

/**
 * Contagem regressiva contextual (Parte A item 5) - so para desafios
 * realmente em andamento (nunca para pausado/encerrado/nao iniciado, nunca
 * um numero negativo). daysRemaining conta o dia de hoje como restante
 * (durationDays - currentDay + 1), entao "ultimo dia" e daysRemaining === 1.
 */
export function describeMissionCountdown(input: {
  currentDay: number;
  durationDays: number;
  isActive: boolean;
}): string | null {
  if (!input.isActive) return null;

  const daysRemaining = input.durationDays - input.currentDay + 1;
  if (daysRemaining <= 0) return null;

  if (daysRemaining === 1) {
    return "Último dia. Continue firme.";
  }

  if (daysRemaining <= 3) {
    return `Faltam ${daysRemaining} dias para concluir este ciclo.`;
  }

  if (daysRemaining <= 7) {
    return "Última semana. Continue firme.";
  }

  const halfway = Math.ceil(input.durationDays / 2);
  if (input.currentDay === halfway) {
    return "Você chegou à metade do desafio.";
  }

  return null;
}

export type PointsContext = {
  todayLabel: string | null;
  totalLabel: string;
  weekLabel: string | null;
};

/**
 * "Pontos com contexto" (Parte B item 7) - nunca calcula um valor que nao
 * exista de verdade: pointsToday/pointsThisWeek sao null quando o chamador
 * nao tem esse dado (ex.: nenhum desafio ativo), nunca um zero fabricado
 * como se fosse um dado real.
 */
export function describePointsContext(input: {
  pointsThisWeek: number | null;
  pointsToday: number | null;
  pointsTotal: number;
}): PointsContext {
  return {
    todayLabel: input.pointsToday !== null && input.pointsToday > 0 ? `+${input.pointsToday} hoje` : null,
    totalLabel: `${input.pointsTotal.toLocaleString("pt-BR")} pontos no total`,
    weekLabel:
      input.pointsThisWeek !== null && input.pointsThisWeek > 0
        ? `+${input.pointsThisWeek} nesta semana`
        : null,
  };
}

export type StreakContext = {
  bestLabel: string;
  currentLabel: string;
  gapMessage: string | null;
};

/**
 * "Sequencia com contexto" (Parte B item 8) - nunca mostra "faltam 0 dias"
 * (empate com o recorde e o proprio caso "Você bateu sua melhor sequência",
 * ja tratado em describeEvolutionHighlight - aqui so o texto neutro de
 * apoio, sem repetir esse anuncio).
 */
export function describeStreakContext(input: { streakBest: number; streakCurrent: number }): StreakContext {
  const gap = input.streakBest - input.streakCurrent;

  return {
    bestLabel: `Seu recorde: ${input.streakBest} ${input.streakBest === 1 ? "dia" : "dias"}.`,
    currentLabel: `Sequência atual: ${input.streakCurrent} ${input.streakCurrent === 1 ? "dia" : "dias"}.`,
    gapMessage:
      gap > 0 ? `Faltam ${gap} ${gap === 1 ? "dia" : "dias"} para igualar seu recorde.` : null,
  };
}
