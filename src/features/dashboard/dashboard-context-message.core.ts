/**
 * Motor de mensagem contextual central do Dashboard (Refinamento premium,
 * Parte C item 7) - resolve UMA unica mensagem principal por prioridade,
 * a partir de dados ja calculados em outros modulos puros
 * (dashboard-mission.core, profile-evolution.core) e servicos existentes.
 * Nunca reimplementa uma regra - so decide QUAL mensagem, entre as que tem
 * dado real por tras, deve aparecer primeiro. Nenhuma condicional deve
 * ficar espalhada em componentes: todo componente que precisa da mensagem
 * do Dashboard chama so esta funcao.
 */

export type ContextMessageCategory =
  | "close_to_achievement"
  | "close_to_record"
  | "day_completed"
  | "day_message"
  | "fallback"
  | "faith"
  | "final_stretch"
  | "halfway"
  | "new_record"
  | "vs_yesterday";

export type ContextMessage = {
  category: ContextMessageCategory;
  text: string;
};

export type ContextMessageInput = {
  challengeDayMessage: string | null;
  closestLockedAchievement: { current: number; name: string; target: number } | null;
  currentDay: number | null;
  dayOverDayMessage: string | null;
  daysFinalized: number;
  daysRemainingInChallenge: number | null;
  durationDays: number | null;
  faithMessage: string | null;
  streakBest: number;
  streakCurrent: number;
  todayCompletionPercent: number | null;
  todayFinalized: boolean;
};

function pluralDays(count: number): string {
  return count === 1 ? "dia" : "dias";
}

/**
 * 10 prioridades exatas do briefing. Cada tier so participa se o dado real
 * que ele descreve existe - nunca um fallback disfarcado de estado real.
 * Retorna sempre exatamente UMA mensagem (nunca empilha, nunca combina).
 */
export function resolveDashboardContextMessage(input: ContextMessageInput): ContextMessage {
  // 1) dia concluido - so quando o dia de HOJE ja foi finalizado.
  if (input.todayFinalized) {
    const text =
      input.todayCompletionPercent !== null && input.todayCompletionPercent >= 100
        ? "Você concluiu tudo que estava disponível hoje."
        : "Seu dia foi finalizado, e cada ação contou.";
    return { category: "day_completed", text };
  }

  // 2) novo recorde - sequencia atual EMPATA (ou seja, acabou de igualar/
  // superar) o recorde anterior, com um streak real (> 0).
  if (input.streakCurrent > 0 && input.streakCurrent === input.streakBest) {
    return { category: "new_record", text: "Você bateu sua melhor sequência." };
  }

  // 3) sequencia perto do recorde - falta pouco (1-2 dias) para igualar.
  const streakGap = input.streakBest - input.streakCurrent;
  if (streakGap > 0 && streakGap <= 2) {
    return {
      category: "close_to_record",
      text: `Falta ${streakGap} ${pluralDays(streakGap)} para igualar seu recorde.`,
    };
  }

  // 4) conquista proxima - progresso numerico real e perto (1-2 passos).
  if (input.closestLockedAchievement) {
    const gap = input.closestLockedAchievement.target - input.closestLockedAchievement.current;
    if (gap > 0 && gap <= 2) {
      return {
        category: "close_to_achievement",
        text: `Mais ${gap} ${gap === 1 ? "passo" : "passos"} podem desbloquear uma nova conquista.`,
      };
    }
  }

  // 5) metade do desafio - dia atual e exatamente o dia da metade.
  if (input.currentDay !== null && input.durationDays !== null) {
    const halfway = Math.ceil(input.durationDays / 2);
    if (input.currentDay === halfway) {
      return { category: "halfway", text: "Você chegou à metade do desafio." };
    }
  }

  // 6) ultimos dias - reta final do ciclo (ate 7 dias restantes).
  if (
    input.daysRemainingInChallenge !== null &&
    input.daysRemainingInChallenge > 0 &&
    input.daysRemainingInChallenge <= 7
  ) {
    const text =
      input.daysRemainingInChallenge === 1
        ? "Último dia. Continue firme."
        : input.daysRemainingInChallenge <= 3
          ? `Faltam ${input.daysRemainingInChallenge} dias para concluir este ciclo.`
          : "Última semana. Continue firme.";
    return { category: "final_stretch", text };
  }

  // 7) evolucao em relacao a ontem - so quando ha uma comparacao real.
  if (input.dayOverDayMessage) {
    return { category: "vs_yesterday", text: input.dayOverDayMessage };
  }

  // 8) mensagem especifica do dia (challenge_days.message).
  if (input.challengeDayMessage?.trim()) {
    return { category: "day_message", text: input.challengeDayMessage.trim() };
  }

  // 9) mensagem de fe elegivel (categoria "fe", so quando ha conteudo ativo).
  if (input.faithMessage?.trim()) {
    return { category: "faith", text: input.faithMessage.trim() };
  }

  // 10) fallback honesto - nunca uma frase vaga que finja um dado que nao existe.
  if (input.daysFinalized > 0) {
    return {
      category: "fallback",
      text: `Você já concluiu ${input.daysFinalized} ${pluralDays(input.daysFinalized)} deste ciclo.`,
    };
  }

  return { category: "fallback", text: "Sua jornada está prestes a começar." };
}
