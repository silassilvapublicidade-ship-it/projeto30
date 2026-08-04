/**
 * Dashboard de Evolucao Pessoal - logica de timeline/conquistas em um unico
 * lugar puro/testavel, nunca inline nos componentes. A mensagem contextual
 * central e o "proximo marco" (antigos describeEvolutionHighlight/
 * describeNextObjective, que viviam aqui) foram substituidos por
 * resolveDashboardContextMessage e resolveNextMilestone em
 * src/features/dashboard/ (Refinamento premium, Parte C) - priorizacao fixa
 * de 10/7 tiers em vez de "menor distancia primeiro".
 */

export type TimelineEventType =
  | "achievement_unlocked"
  | "challenge_abandoned"
  | "challenge_completed"
  | "challenge_started"
  | "day_finalized"
  | "halfway_reached"
  | "streak_record";

export const TIMELINE_EVENT_TYPES: readonly TimelineEventType[] = [
  "day_finalized",
  "achievement_unlocked",
  "challenge_started",
  "challenge_completed",
  "challenge_abandoned",
  "streak_record",
  "halfway_reached",
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
  // halfway_reached agrupado aqui com streak_record (ambos "marcos" da
  // jornada) em vez de um sexto chip de filtro - decisao de escopo
  // documentada no relatorio final.
  { key: "records", label: "Recordes", types: ["streak_record", "halfway_reached"] },
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
  habit_titles: string[] | null;
  points: number | null;
  streak_value: number | null;
};

export type TimelineEventIconKey =
  | "achievement"
  | "challenge_abandon"
  | "challenge_complete"
  | "challenge_start"
  | "day"
  | "halfway"
  | "record";

export type TimelineEventDisplay = {
  description: string;
  iconKey: TimelineEventIconKey;
  title: string;
};

const MAX_HABIT_TITLES_SHOWN = 3;

function formatPoints(points: number | null): string | null {
  if (points === null || points <= 0) return null;
  return `${points} ${points === 1 ? "ponto" : "pontos"}`;
}

/**
 * "Treino, Bíblia, Oração e mais 4 hábitos." (Parte C item 15) - limita a
 * quantidade exibida em vez de listar todos, nunca um evento por habito
 * (poluiria a timeline).
 */
export function formatHabitTitlesSummary(titles: string[] | null): string | null {
  if (!titles || titles.length === 0) return null;

  if (titles.length <= MAX_HABIT_TITLES_SHOWN) {
    return titles.join(", ");
  }

  const shown = titles.slice(0, MAX_HABIT_TITLES_SHOWN);
  const remaining = titles.length - MAX_HABIT_TITLES_SHOWN;
  return `${shown.join(", ")} e mais ${remaining} ${remaining === 1 ? "hábito" : "hábitos"}.`;
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
      const habitsSummary = formatHabitTitlesSummary(event.habit_titles);
      const parts = [
        formatPoints(event.points),
        percent !== null ? `${percent}% concluído` : null,
        habitsSummary,
      ].filter((part): part is string => Boolean(part));
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
    case "halfway_reached":
      return {
        description: event.challenge_name ?? "",
        iconKey: "halfway",
        title: "Você chegou à metade do desafio",
      };
  }
}

export type TimelineDateGroup = {
  dateKey: string;
  dateLabel: string;
  events: TimelineEventRow[];
};

function toDateOnlyKey(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Agrupamento por data (Parte C item 14) - puro, so reorganiza os eventos
 * ja recebidos de uma pagina da timeline, nunca refaz a ordenacao ou busca
 * mais dados. "today"/"yesterday" (date-only, mesmo fuso do resto do
 * dashboard) definem os rotulos especiais "Hoje"/"Ontem"; qualquer outra
 * data usa DD/MM.
 */
export function groupTimelineEventsByDate(
  events: readonly TimelineEventRow[],
  today: string,
  yesterday: string,
): TimelineDateGroup[] {
  const groups: TimelineDateGroup[] = [];
  const groupByKey = new Map<string, TimelineDateGroup>();

  for (const event of events) {
    const dateKey = toDateOnlyKey(event.event_at);
    let group = groupByKey.get(dateKey);

    if (!group) {
      const dateLabel =
        dateKey === today
          ? "Hoje"
          : dateKey === yesterday
            ? "Ontem"
            : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(
                new Date(`${dateKey}T00:00:00Z`),
              );
      group = { dateKey, dateLabel, events: [] };
      groupByKey.set(dateKey, group);
      groups.push(group);
    }

    group.events.push(event);
  }

  return groups;
}

export type ClosestLockedAchievement = {
  challengeName: string | null;
  current: number;
  description: string | null;
  icon: string | null;
  name: string;
  target: number;
};

type LockedAchievementCandidate = {
  challengeName?: string | null;
  description?: string | null;
  icon?: string | null;
  name: string;
  progress: { current: number; target: number } | null;
};

/**
 * Escolhe, entre as conquistas ainda bloqueadas (com progresso numerico
 * real - achievements.core.ts's getAchievementProgress ja devolve null
 * para criterios booleanos como "retorno-forte", que nunca entram aqui, e
 * portanto nunca aparecem como "proxima conquista" - nunca revela uma
 * conquista de criterio secreto/nao medivel), a que esta mais perto de ser
 * desbloqueada. Usado tanto pelo bloco "Proximo objetivo" quanto pelo novo
 * bloco dedicado "Proxima conquista" (Parte B item 10).
 */
export function findClosestLockedAchievement(
  locked: ReadonlyArray<LockedAchievementCandidate>,
): ClosestLockedAchievement | null {
  let closest: ClosestLockedAchievement | null = null;
  let closestGap = Infinity;

  for (const achievement of locked) {
    if (!achievement.progress) continue;
    const gap = achievement.progress.target - achievement.progress.current;
    if (gap < closestGap) {
      closestGap = gap;
      closest = {
        challengeName: achievement.challengeName ?? null,
        current: achievement.progress.current,
        description: achievement.description ?? null,
        icon: achievement.icon ?? null,
        name: achievement.name,
        target: achievement.progress.target,
      };
    }
  }

  return closest;
}
