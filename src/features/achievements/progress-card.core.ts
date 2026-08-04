import { createHash } from "node:crypto";

import type { SceneId } from "./achievement-scene.core";

export type ProgressCardKind =
  | "challenge_completed"
  | "challenge_progress"
  | "day_completed"
  | "halfway"
  | "last_7_days"
  | "streak_reached"
  | "streak_record"
  | "weekly_summary";

/** 3 tipos ancorados num dia especifico (daily_log_id); 5 fotografam o estado da inscricao (snapshot_enrollment_id). */
export const DAY_ANCHORED_PROGRESS_CARD_KINDS: readonly ProgressCardKind[] = [
  "day_completed",
  "streak_record",
  "streak_reached",
];

export const ENROLLMENT_SNAPSHOT_PROGRESS_CARD_KINDS: readonly ProgressCardKind[] = [
  "halfway",
  "last_7_days",
  "weekly_summary",
  "challenge_progress",
  "challenge_completed",
];

/**
 * Um unico "saco" plano de campos opcionais (em vez de uma union
 * discriminada) - mesmo raciocinio pratico ja usado no resto do modulo:
 * buildProgressCardContent continua uma unica funcao pura, e cada branch so
 * le os campos que o seu tipo realmente usa. Nenhum campo aqui e
 * "inventado" pelo builder - todos vem prontos de progress-share.service.ts
 * (dia especifico) ou de snapshot-share.service.ts (estado da inscricao).
 */
export type ProgressCardSource = {
  achievementsUnlocked: number | null;
  challengeName: string;
  completionPercent: number | null;
  dayNumber: number | null;
  daysFinalized: number | null;
  daysRemaining: number | null;
  durationDays: number | null;
  finalMessage: string | null;
  habitTitles: string[] | null;
  kind: ProgressCardKind;
  logDate: string;
  pointsEarned: number | null;
  pointsTotal: number | null;
  previousStreakBest: number | null;
  streakBest: number | null;
  streakValue: number | null;
  weekAverageCompletion: number | null;
  weekBestStreak: number | null;
  weekDaysFinalized: number | null;
  weekHabitsCompleted: number | null;
  weekPoints: number | null;
};

export type ProgressCardIcon =
  | "calendar-check"
  | "flame"
  | "gem"
  | "route"
  | "star"
  | "sunrise"
  | "trophy"
  | "zap";

export type ProgressCardContent = {
  attributionLine: string;
  challengeLabel: string | null;
  dateLabel: string;
  footerLine: string;
  icon: ProgressCardIcon;
  kind: ProgressCardKind;
  microDetails: string[];
  sceneId: SceneId;
  subtitle: string | null;
  title: string;
};

const MAX_HABITS_ON_CARD = 4;

function formatDateLabel(logDate: string): string {
  const parsed = new Date(`${logDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC", year: "numeric" }).format(
    parsed,
  );
}

function formatHabitsList(titles: string[] | null): string | null {
  if (!titles || titles.length === 0) return null;
  if (titles.length <= MAX_HABITS_ON_CARD) return titles.join(", ");
  const remaining = titles.length - MAX_HABITS_ON_CARD;
  return `${titles.slice(0, MAX_HABITS_ON_CARD).join(", ")} e mais ${remaining} ${remaining === 1 ? "hábito" : "hábitos"}`;
}

function pluralDays(count: number): string {
  return count === 1 ? "dia" : "dias";
}

function formatPointsLabel(points: number | null): string | null {
  if (points === null || points <= 0) return null;
  return `${points} ${points === 1 ? "ponto" : "pontos"}`;
}

/**
 * Conteudo puro para os 8 tipos de card de progresso (Refinamento premium,
 * Parte E) - mesmo padrao de buildAchievementCardContent (separa a
 * montagem de dados da renderizacao JSX/Satori). displayName e
 * deliberadamente OMITIDO da assinatura: card de progresso nunca usa o
 * nome do usuario - nunca inclui e-mail em nenhum caso.
 */
export function buildProgressCardContent(source: ProgressCardSource): ProgressCardContent {
  switch (source.kind) {
    case "day_completed": {
      const percent = source.completionPercent !== null ? Math.round(source.completionPercent) : null;
      const habitsLine = formatHabitsList(source.habitTitles);

      return {
        attributionLine: "Dia concluído",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "sunrise",
        kind: "day_completed",
        microDetails: [
          percent !== null ? `${percent}% concluído` : null,
          formatPointsLabel(source.pointsEarned),
          source.streakValue !== null ? `Sequência: ${source.streakValue} ${pluralDays(source.streakValue)}` : null,
        ].filter((value): value is string => Boolean(value)),
        sceneId: "sunrise-glow",
        subtitle: habitsLine,
        title: source.dayNumber !== null ? `Dia ${source.dayNumber} concluído` : "Dia concluído",
      };
    }

    case "streak_record": {
      const recordLabel =
        source.streakValue !== null ? `${source.streakValue} ${pluralDays(source.streakValue)} seguidos` : null;

      return {
        attributionLine: "Novo recorde de sequência",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "flame",
        kind: "streak_record",
        microDetails: [
          source.previousStreakBest !== null && source.previousStreakBest > 0
            ? `Recorde anterior: ${source.previousStreakBest} ${pluralDays(source.previousStreakBest)}`
            : null,
        ].filter((value): value is string => Boolean(value)),
        sceneId: "ember-rise",
        subtitle: recordLabel ? `${recordLabel} - o maior desde que você começou.` : null,
        title: "Novo recorde de sequência",
      };
    }

    case "streak_reached": {
      const days = source.streakValue ?? 0;

      return {
        attributionLine: "Sequência em alta",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "zap",
        kind: "streak_reached",
        microDetails: [formatPointsLabel(source.pointsEarned)].filter((value): value is string => Boolean(value)),
        sceneId: "ascending-lines",
        subtitle: "Consistência real, dia após dia.",
        title: `${days} ${pluralDays(days)} seguidos`,
      };
    }

    case "halfway": {
      const halfwayDay = source.durationDays !== null ? Math.ceil(source.durationDays / 2) : null;

      return {
        attributionLine: "Metade do desafio",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "route",
        kind: "halfway",
        microDetails: [
          formatPointsLabel(source.pointsTotal),
          source.daysFinalized !== null ? `${source.daysFinalized} ${pluralDays(source.daysFinalized)} finalizados` : null,
          source.streakBest !== null && source.streakBest > 0
            ? `Sequência: ${source.streakBest} ${pluralDays(source.streakBest)}`
            : null,
        ].filter((value): value is string => Boolean(value)),
        sceneId: "progress-marker",
        subtitle: halfwayDay !== null ? `Dia ${halfwayDay} de ${source.durationDays}` : null,
        title: "Você chegou à metade do desafio",
      };
    }

    case "last_7_days": {
      const remaining = source.daysRemaining ?? 0;
      const percent = source.completionPercent !== null ? Math.round(source.completionPercent) : null;

      return {
        attributionLine: "Reta final",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "calendar-check",
        kind: "last_7_days",
        microDetails: [percent !== null ? `${percent}% concluído` : null].filter(
          (value): value is string => Boolean(value),
        ),
        sceneId: "speed-lines",
        subtitle: "A reta final começou. Continue firme.",
        title: remaining <= 1 ? "Último dia" : `Faltam ${remaining} ${pluralDays(remaining)}`,
      };
    }

    case "weekly_summary": {
      const percent = source.weekAverageCompletion !== null ? Math.round(source.weekAverageCompletion) : null;

      return {
        attributionLine: "Resumo semanal",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "star",
        kind: "weekly_summary",
        microDetails: [
          formatPointsLabel(source.weekPoints),
          percent !== null ? `Média de ${percent}% concluído` : null,
          source.weekBestStreak !== null && source.weekBestStreak > 0
            ? `Melhor sequência: ${source.weekBestStreak} ${pluralDays(source.weekBestStreak)}`
            : null,
        ].filter((value): value is string => Boolean(value)),
        sceneId: "sequence-marks",
        subtitle:
          source.weekDaysFinalized !== null
            ? `${source.weekDaysFinalized} de 7 dias finalizados nesta semana.`
            : null,
        title: "Sua semana em resumo",
      };
    }

    case "challenge_progress": {
      const percent = source.completionPercent !== null ? Math.round(source.completionPercent) : null;

      return {
        attributionLine: "Progresso do desafio",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "gem",
        kind: "challenge_progress",
        microDetails: [
          formatPointsLabel(source.pointsTotal),
          source.achievementsUnlocked !== null
            ? `${source.achievementsUnlocked} ${source.achievementsUnlocked === 1 ? "conquista" : "conquistas"}`
            : null,
          source.streakBest !== null && source.streakBest > 0
            ? `Recorde: ${source.streakBest} ${pluralDays(source.streakBest)}`
            : null,
        ].filter((value): value is string => Boolean(value)),
        sceneId: "loop-arc",
        subtitle:
          source.daysFinalized !== null && source.durationDays !== null
            ? `${source.daysFinalized} de ${source.durationDays} dias concluídos`
            : null,
        title: percent !== null ? `${percent}% do caminho percorrido` : "Progresso do desafio",
      };
    }

    case "challenge_completed": {
      return {
        attributionLine: "Desafio concluído",
        challengeLabel: source.challengeName,
        dateLabel: formatDateLabel(source.logDate),
        footerLine: "projeto30.app",
        icon: "trophy",
        kind: "challenge_completed",
        microDetails: [
          formatPointsLabel(source.pointsTotal),
          source.daysFinalized !== null ? `${source.daysFinalized} ${pluralDays(source.daysFinalized)} finalizados` : null,
          source.streakBest !== null && source.streakBest > 0
            ? `Melhor sequência: ${source.streakBest} ${pluralDays(source.streakBest)}`
            : null,
          source.achievementsUnlocked !== null
            ? `${source.achievementsUnlocked} ${source.achievementsUnlocked === 1 ? "conquista" : "conquistas"}`
            : null,
        ].filter((value): value is string => Boolean(value)),
        sceneId: "grid-bloom",
        subtitle: source.finalMessage,
        title: "Desafio concluído",
      };
    }
  }
}

export type ProgressSharePayloadHashInput = {
  anchorId: string;
  content: ProgressCardContent;
  templateSlug: string;
  templateVersion: number;
};

/** Mesmo raciocinio de computeSharePayloadHash (achievement-art.core.ts), ancorado no id real (dia ou inscricao) em vez de achievementId. */
export function computeProgressSharePayloadHash(input: ProgressSharePayloadHashInput): string {
  const normalized = JSON.stringify({
    anchorId: input.anchorId,
    content: input.content,
    templateSlug: input.templateSlug,
    templateVersion: input.templateVersion,
  });

  return createHash("sha256").update(normalized).digest("hex");
}

export function buildProgressShareCardStoragePath(
  userId: string,
  anchorId: string,
  kind: ProgressCardKind,
  format: "feed" | "story",
): string {
  return `progress/${userId}/${anchorId}/${kind}-${format}.png`;
}
