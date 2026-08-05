// Lista canônica das 10 conquistas do desafio-base - o desbloqueio real
// roda em SQL (finalize_daily_log_with_responses), mas esta lista continua
// viva como guardrail: scripts administrativos de novos desafios (ver
// august-challenge-script.test.ts) validam contra ela para garantir que
// nenhum slug de conquista novo/renomeado seja introduzido sem revisão.
export const initialAchievementSlugs = [
  "primeiro-habito",
  "primeiro-dia",
  "tres-dias-seguidos",
  "primeira-semana",
  "sete-leituras",
  "sete-atividades-fisicas",
  "sete-reflexoes",
  "metade-do-caminho",
  "retorno-forte",
  "missao-concluida",
] as const;

export type InitialAchievementSlug = (typeof initialAchievementSlugs)[number];

export type AchievementCheckInput = {
  completedCycle: boolean;
  completedHabitsLifetime: number;
  durationDays: number;
  finalizedDays: number;
  physicalActivityCompletions: number;
  readingCompletions: number;
  reflectionDays: number;
  returnStrong: boolean;
  streakCurrent: number;
};

export function getHalfwayTarget(durationDays: number) {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error("durationDays precisa ser um inteiro positivo.");
  }

  return Math.ceil(durationDays / 2);
}

export type AchievementProgress = {
  current: number;
  target: number;
};

/**
 * Numeric progress toward a still-locked achievement, for slugs with a
 * countable threshold. Returns null for slugs whose criterion is a boolean
 * condition (e.g. "retorno-forte") rather than a running count - there is
 * no honest fraction to show for those.
 *
 * O desbloqueio em si (quais conquistas viram unlocked) roda em SQL
 * (finalize_daily_log_with_responses) - esta função só calcula o
 * current/target exibido na UI para uma conquista ainda travada, nunca
 * decide se ela desbloqueou.
 */
export function getAchievementProgress(
  slug: string,
  input: AchievementCheckInput,
): AchievementProgress | null {
  switch (slug) {
    case "primeiro-habito":
      return { current: Math.min(input.completedHabitsLifetime, 1), target: 1 };
    case "primeiro-dia":
      return { current: Math.min(input.finalizedDays, 1), target: 1 };
    case "tres-dias-seguidos":
      return { current: Math.min(input.streakCurrent, 3), target: 3 };
    case "primeira-semana":
      return { current: Math.min(input.finalizedDays, 7), target: 7 };
    case "sete-leituras":
      return { current: Math.min(input.readingCompletions, 7), target: 7 };
    case "sete-atividades-fisicas":
      return { current: Math.min(input.physicalActivityCompletions, 7), target: 7 };
    case "sete-reflexoes":
      return { current: Math.min(input.reflectionDays, 7), target: 7 };
    case "metade-do-caminho": {
      const target = getHalfwayTarget(input.durationDays);
      return { current: Math.min(input.finalizedDays, target), target };
    }
    case "missao-concluida":
      return { current: Math.min(input.finalizedDays, input.durationDays), target: input.durationDays };
    case "retorno-forte":
      return null;
    default:
      return null;
  }
}
