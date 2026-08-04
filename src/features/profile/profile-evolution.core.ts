/**
 * Dashboard de Evolucao Pessoal - toda a logica de mensagem dinamica em um
 * unico lugar puro/testavel, nunca inline nos componentes. Nenhuma funcao
 * aqui inventa dado: cada mensagem so aparece quando o dado real que ela
 * descreve existe (ver o fallback de describeNextObjective/
 * describeEvolutionHighlight - nunca uma frase vaga no lugar de silencio).
 */

export type TimelineEventType =
  | "achievement_unlocked"
  | "challenge_abandoned"
  | "challenge_completed"
  | "challenge_started"
  | "day_finalized"
  | "streak_record";

export const TIMELINE_EVENT_TYPES: readonly TimelineEventType[] = [
  "day_finalized",
  "achievement_unlocked",
  "challenge_started",
  "challenge_completed",
  "challenge_abandoned",
  "streak_record",
];

export type TimelineFilterKey = "achievements" | "all" | "challenges" | "days" | "records";

export const TIMELINE_FILTERS: ReadonlyArray<{
  key: TimelineFilterKey;
  label: string;
  types: TimelineEventType[] | null;
}> = [
  { key: "all", label: "Tudo", types: null },
  { key: "days", label: "Dias", types: ["day_finalized"] },
  { key: "achievements", label: "Conquistas", types: ["achievement_unlocked"] },
  { key: "challenges", label: "Desafios", types: ["challenge_started", "challenge_completed", "challenge_abandoned"] },
  { key: "records", label: "Recordes", types: ["streak_record"] },
];

export function getTimelineFilterTypes(key: TimelineFilterKey): TimelineEventType[] | null {
  return TIMELINE_FILTERS.find((filter) => filter.key === key)?.types ?? null;
}

export type TimelineEventRow = {
  achievement_icon: string | null;
  achievement_name: string | null;
  achievement_rarity: string | null;
  achievement_slug: string | null;
  challenge_id: string;
  challenge_name: string | null;
  completion_percent: number | null;
  day_number: number | null;
  enrollment_id: string;
  event_at: string;
  event_source_id: string;
  event_type: TimelineEventType;
  points: number | null;
  streak_value: number | null;
};

export type TimelineEventIconKey =
  | "achievement"
  | "challenge_abandon"
  | "challenge_complete"
  | "challenge_start"
  | "day"
  | "record";

export type TimelineEventDisplay = {
  description: string;
  iconKey: TimelineEventIconKey;
  title: string;
};

function formatPoints(points: number | null): string | null {
  if (points === null || points <= 0) return null;
  return `${points} ${points === 1 ? "ponto" : "pontos"}`;
}

/**
 * Um evento por linha (nunca funde "dia finalizado" com a conquista que ele
 * desbloqueou no mesmo instante em um unico card) - simplificacao
 * deliberada: os dois aparecem adjacentes na lista (mesmo event_at),
 * transmitindo a mesma informacao sem a complexidade de agrupamento.
 */
export function describeTimelineEvent(event: TimelineEventRow): TimelineEventDisplay {
  switch (event.event_type) {
    case "day_finalized": {
      const percent = event.completion_percent !== null ? Math.round(event.completion_percent) : null;
      const parts = [formatPoints(event.points), percent !== null ? `${percent}% concluído` : null].filter(
        (part): part is string => Boolean(part),
      );
      return {
        description: parts.length > 0 ? parts.join(" · ") : "Dia registrado.",
        iconKey: "day",
        title: event.day_number !== null ? `Dia ${event.day_number} finalizado` : "Dia finalizado",
      };
    }
    case "achievement_unlocked":
      return {
        description: formatPoints(event.points) ?? "Sem pontos de bônus.",
        iconKey: "achievement",
        title: event.achievement_name ? `Conquista desbloqueada: ${event.achievement_name}` : "Conquista desbloqueada",
      };
    case "challenge_started":
      return {
        description: event.challenge_name ?? "",
        iconKey: "challenge_start",
        title: "Desafio iniciado",
      };
    case "challenge_completed":
      return {
        description: event.challenge_name ?? "",
        iconKey: "challenge_complete",
        title: "Desafio concluído",
      };
    case "challenge_abandoned":
      return {
        description: event.challenge_name ?? "",
        iconKey: "challenge_abandon",
        title: "Desafio abandonado",
      };
    case "streak_record": {
      const days = event.streak_value !== null ? `${event.streak_value} ${event.streak_value === 1 ? "dia" : "dias"}` : null;
      return {
        description: days ? `${days} seguidos - o maior desde que você começou.` : "Novo recorde de sequência.",
        iconKey: "record",
        title: "Novo recorde de sequência",
      };
    }
  }
}

/**
 * Bloco de destaque (Parte 5) - uma unica mensagem, escolhida por
 * prioridade entre as que tem dado real por tras. Nunca combina duas
 * mensagens, nunca usa comparacao social.
 */
export function describeEvolutionHighlight(input: {
  currentDay: number | null;
  daysFinalized: number;
  daysRemainingInChallenge: number | null;
  dayOverDayMessage: string | null;
  durationDays: number | null;
  streakBest: number;
  streakCurrent: number;
}): string {
  if (input.streakCurrent > 0 && input.streakCurrent === input.streakBest) {
    return "Você bateu sua melhor sequência.";
  }

  if (input.dayOverDayMessage) {
    return input.dayOverDayMessage;
  }

  if (input.daysRemainingInChallenge !== null && input.daysRemainingInChallenge > 0 && input.daysRemainingInChallenge <= 5) {
    return `Faltam ${input.daysRemainingInChallenge} ${input.daysRemainingInChallenge === 1 ? "dia" : "dias"} para concluir este desafio.`;
  }

  if (input.currentDay !== null && input.durationDays !== null) {
    const halfway = Math.ceil(input.durationDays / 2);
    if (input.currentDay === halfway) {
      return "Você está na metade do caminho.";
    }
  }

  if (input.streakBest > 0) {
    return `Seu recorde atual é de ${input.streakBest} ${input.streakBest === 1 ? "dia" : "dias"}.`;
  }

  if (input.daysFinalized > 0) {
    return `Você já concluiu ${input.daysFinalized} ${input.daysFinalized === 1 ? "dia" : "dias"}.`;
  }

  return "Sua jornada está prestes a começar.";
}

/**
 * "Proximo objetivo" (Parte 12) - so objetivos calculaveis com o dado que
 * ja temos (sequencia, metade do desafio, conquista mais proxima). Metas
 * semanais/mensais especificas por habito (ex.: "faltam 2 treinos") ficam
 * de fora nesta rodada - exigiriam uma consulta extra por habito que o
 * overview nao traz, documentado como pendencia no relatorio final.
 */
export function describeNextObjective(input: {
  closestLockedAchievement: { current: number; name: string; target: number } | null;
  currentDay: number | null;
  durationDays: number | null;
  streakBest: number;
  streakCurrent: number;
}): string {
  const candidates: Array<{ gap: number; message: string }> = [];

  if (input.streakBest > input.streakCurrent) {
    const gap = input.streakBest - input.streakCurrent;
    candidates.push({
      gap,
      message: `Complete mais ${gap} ${gap === 1 ? "dia" : "dias"} para igualar seu recorde de ${input.streakBest} ${
        input.streakBest === 1 ? "dia" : "dias"
      }.`,
    });
  }

  if (input.currentDay !== null && input.durationDays !== null) {
    const halfway = Math.ceil(input.durationDays / 2);
    if (input.currentDay < halfway) {
      const gap = halfway - input.currentDay;
      candidates.push({ gap, message: `Faltam ${gap} ${gap === 1 ? "dia" : "dias"} para a metade do desafio.` });
    }
  }

  if (input.closestLockedAchievement && input.closestLockedAchievement.current < input.closestLockedAchievement.target) {
    const gap = input.closestLockedAchievement.target - input.closestLockedAchievement.current;
    candidates.push({
      gap,
      message: `Faltam ${gap} ${gap === 1 ? "passo" : "passos"} para desbloquear "${input.closestLockedAchievement.name}".`,
    });
  }

  if (candidates.length === 0) {
    return "Continue registrando sua jornada. Cada dia conta.";
  }

  candidates.sort((a, b) => a.gap - b.gap);
  return candidates[0]!.message;
}

/**
 * Escolhe, entre as conquistas ainda bloqueadas (com progresso numerico
 * real - achievements.core.ts's getAchievementProgress ja devolve null
 * para criterios booleanos como "retorno-forte", que nunca entram aqui),
 * a que esta mais perto de ser desbloqueada.
 */
export function findClosestLockedAchievement(
  locked: ReadonlyArray<{ name: string; progress: { current: number; target: number } | null }>,
): { current: number; name: string; target: number } | null {
  let closest: { current: number; name: string; target: number } | null = null;
  let closestGap = Infinity;

  for (const achievement of locked) {
    if (!achievement.progress) continue;
    const gap = achievement.progress.target - achievement.progress.current;
    if (gap < closestGap) {
      closestGap = gap;
      closest = { current: achievement.progress.current, name: achievement.name, target: achievement.progress.target };
    }
  }

  return closest;
}
