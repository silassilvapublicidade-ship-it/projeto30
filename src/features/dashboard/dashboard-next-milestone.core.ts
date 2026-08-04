/**
 * "Seu próximo marco" (Refinamento premium, Parte C item 11) - escolhe UM
 * marco por prioridade fixa (nunca o de "menor distância", diferente do
 * antigo describeNextObjective em profile-evolution.core.ts) entre os 7
 * tipos do briefing. "Manter a sequência" não vira um tier próprio: quando o
 * dia de hoje ainda não foi finalizado, é exatamente isso que finalizar o
 * dia (tier 1) já significa - um tier extra aqui só duplicaria a mesma
 * mensagem ou inventaria uma frase genérica sem dado por trás, o que o
 * briefing proíbe. Mesma decisão documentada já usada em
 * describeNextObjective (tier "finalizar o desafio" não duplicado ali).
 */

export type NextMilestoneKind =
  | "complete_challenge"
  | "finish_day"
  | "final_week"
  | "reach_halfway"
  | "tie_record"
  | "unlock_achievement";

export type NextMilestone = {
  cta: string;
  distance: string;
  kind: NextMilestoneKind;
  /** Fracao de 0 a 1 quando calculavel a partir de dado real; null quando nao ha uma barra que faca sentido. */
  progress: number | null;
  title: string;
};

export type NextMilestoneInput = {
  applicableHabits: number;
  closestLockedAchievement: { current: number; name: string; target: number } | null;
  completedHabits: number;
  currentDay: number | null;
  daysRemainingInChallenge: number | null;
  durationDays: number | null;
  streakBest: number;
  streakCurrent: number;
  todayFinalized: boolean;
};

function pluralDays(count: number): string {
  return count === 1 ? "dia" : "dias";
}

/**
 * 7 prioridades exatas do briefing (item 11), com a fusao documentada acima
 * entre "manter sequencia" e "finalizar o dia". Retorna sempre UM marco (ou
 * null quando nenhum tem dado real por tras - por exemplo, desafio ainda nao
 * comecou).
 */
export function resolveNextMilestone(input: NextMilestoneInput): NextMilestone | null {
  // 1) finalizar o dia atual.
  if (!input.todayFinalized && input.applicableHabits > 0) {
    return {
      cta: "Continuar meu dia",
      distance: `${input.completedHabits} de ${input.applicableHabits} hábitos concluídos hoje.`,
      kind: "finish_day",
      progress: input.completedHabits / input.applicableHabits,
      title: "Finalize seu dia",
    };
  }

  // 2) [manter a sequência - fundido ao tier 1, ver comentário acima]

  // 3) igualar/empatar o recorde de sequência.
  const streakGap = input.streakBest - input.streakCurrent;
  if (streakGap > 0) {
    return {
      cta: "Continuar minha jornada",
      distance: `Falta ${streakGap} ${pluralDays(streakGap)} para igualar seu recorde.`,
      kind: "tie_record",
      progress: input.streakBest > 0 ? input.streakCurrent / input.streakBest : null,
      title: "Iguale seu recorde",
    };
  }

  // 4) desbloquear a conquista mais próxima.
  if (input.closestLockedAchievement) {
    const gap = input.closestLockedAchievement.target - input.closestLockedAchievement.current;
    if (gap > 0) {
      return {
        cta: "Ver conquistas",
        distance: `Mais ${gap} ${gap === 1 ? "passo" : "passos"} para desbloquear ${input.closestLockedAchievement.name}.`,
        kind: "unlock_achievement",
        progress: input.closestLockedAchievement.current / input.closestLockedAchievement.target,
        title: "Desbloqueie uma nova conquista",
      };
    }
  }

  // 5) alcançar a metade do desafio.
  if (input.currentDay !== null && input.durationDays !== null) {
    const halfway = Math.ceil(input.durationDays / 2);
    if (input.currentDay < halfway) {
      const gap = halfway - input.currentDay;
      return {
        cta: "Continuar minha jornada",
        distance: `Faltam ${gap} ${pluralDays(gap)} para chegar à metade do ciclo.`,
        kind: "reach_halfway",
        progress: input.currentDay / halfway,
        title: "Chegue à metade do ciclo",
      };
    }
  }

  // 6) entrar/permanecer na última semana do ciclo.
  if (
    input.daysRemainingInChallenge !== null &&
    input.daysRemainingInChallenge > 0 &&
    input.daysRemainingInChallenge <= 7 &&
    input.durationDays !== null
  ) {
    return {
      cta: "Continuar minha jornada",
      distance: `Faltam ${input.daysRemainingInChallenge} ${pluralDays(input.daysRemainingInChallenge)} para concluir este ciclo.`,
      kind: "final_week",
      progress: (input.durationDays - input.daysRemainingInChallenge) / input.durationDays,
      title: "Última semana",
    };
  }

  // 7) concluir o desafio - exatamente o ultimo dia, ja finalizado, so
  // esperando o fechamento do ciclo.
  if (input.daysRemainingInChallenge === 0) {
    return {
      cta: "Concluir desafio",
      distance: "Você chegou ao último dia do ciclo.",
      kind: "complete_challenge",
      progress: 1,
      title: "Conclua o desafio",
    };
  }

  return null;
}
