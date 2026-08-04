import { createHash } from "node:crypto";

import type { SceneId } from "./achievement-scene.core";

export type ProgressCardKind = "day_completed" | "streak_record";

export type ProgressCardSource = {
  challengeName: string;
  completionPercent: number | null;
  dayNumber: number | null;
  durationDays: number | null;
  habitTitles: string[] | null;
  kind: ProgressCardKind;
  logDate: string;
  pointsEarned: number | null;
  previousStreakBest: number | null;
  streakValue: number | null;
};

export type ProgressCardContent = {
  attributionLine: string;
  challengeLabel: string | null;
  dateLabel: string;
  footerLine: string;
  icon: "flame" | "sunrise";
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

/**
 * Conteudo puro para os 2 tipos de card de progresso desta rodada (dia
 * concluido, novo recorde de sequencia) - mesmo padrao de
 * buildAchievementCardContent (separa a montagem de dados da renderizacao
 * JSX/Satori). displayName e deliberadamente OMITIDO da assinatura: card de
 * progresso nunca usa o nome do usuario (mais anonimo por padrao que o
 * card de conquista, que ja e opcional) - nunca inclui e-mail em nenhum
 * caso.
 */
export function buildProgressCardContent(source: ProgressCardSource): ProgressCardContent {
  if (source.kind === "day_completed") {
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
        source.pointsEarned && source.pointsEarned > 0
          ? `${source.pointsEarned} ${source.pointsEarned === 1 ? "ponto" : "pontos"}`
          : null,
        source.streakValue !== null
          ? `Sequência: ${source.streakValue} ${source.streakValue === 1 ? "dia" : "dias"}`
          : null,
      ].filter((value): value is string => Boolean(value)),
      sceneId: "sunrise-glow",
      subtitle: habitsLine,
      title: source.dayNumber !== null ? `Dia ${source.dayNumber} concluído` : "Dia concluído",
    };
  }

  const recordLabel =
    source.streakValue !== null ? `${source.streakValue} ${source.streakValue === 1 ? "dia" : "dias"} seguidos` : null;

  return {
    attributionLine: "Novo recorde de sequência",
    challengeLabel: source.challengeName,
    dateLabel: formatDateLabel(source.logDate),
    footerLine: "projeto30.app",
    icon: "flame",
    kind: "streak_record",
    microDetails: [
      source.previousStreakBest !== null && source.previousStreakBest > 0
        ? `Recorde anterior: ${source.previousStreakBest} ${source.previousStreakBest === 1 ? "dia" : "dias"}`
        : null,
    ].filter((value): value is string => Boolean(value)),
    sceneId: "ember-rise",
    subtitle: recordLabel ? `${recordLabel} - o maior desde que você começou.` : null,
    title: "Novo recorde de sequência",
  };
}

export type ProgressSharePayloadHashInput = {
  content: ProgressCardContent;
  dailyLogId: string;
  templateSlug: string;
  templateVersion: number;
};

/** Mesmo raciocinio de computeSharePayloadHash (achievement-art.core.ts), ancorado em dailyLogId em vez de achievementId. */
export function computeProgressSharePayloadHash(input: ProgressSharePayloadHashInput): string {
  const normalized = JSON.stringify({
    content: input.content,
    dailyLogId: input.dailyLogId,
    templateSlug: input.templateSlug,
    templateVersion: input.templateVersion,
  });

  return createHash("sha256").update(normalized).digest("hex");
}

export function buildProgressShareCardStoragePath(
  userId: string,
  dailyLogId: string,
  kind: ProgressCardKind,
  format: "feed" | "story",
): string {
  return `progress/${userId}/${dailyLogId}/${kind}-${format}.png`;
}
