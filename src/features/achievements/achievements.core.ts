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

export type AchievementRuleConfig = {
  description: string;
  slug: InitialAchievementSlug;
};

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

export type AchievementCheckResult = {
  unlockedSlugs: InitialAchievementSlug[];
};

export const initialAchievementRules: AchievementRuleConfig[] = [
  {
    slug: "primeiro-habito",
    description: "Desbloqueia ao concluir o primeiro habito do ciclo.",
  },
  {
    slug: "primeiro-dia",
    description: "Desbloqueia ao finalizar o primeiro dia.",
  },
  {
    slug: "tres-dias-seguidos",
    description: "Desbloqueia ao manter tres dias validos seguidos.",
  },
  {
    slug: "primeira-semana",
    description: "Desbloqueia ao finalizar sete dias do ciclo.",
  },
  {
    slug: "sete-leituras",
    description: "Desbloqueia ao concluir sete habitos de leitura.",
  },
  {
    slug: "sete-atividades-fisicas",
    description: "Desbloqueia ao concluir sete habitos de atividade fisica.",
  },
  {
    slug: "sete-reflexoes",
    description: "Desbloqueia ao registrar sete reflexoes.",
  },
  {
    slug: "metade-do-caminho",
    description: "Desbloqueia ao finalizar metade da duracao configurada.",
  },
  {
    slug: "retorno-forte",
    description: "Desbloqueia ao voltar com um dia valido depois de falhar.",
  },
  {
    slug: "missao-concluida",
    description: "Desbloqueia ao concluir a duracao configurada do ciclo.",
  },
];

function assertNonNegativeInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} precisa ser um inteiro nao negativo.`);
  }
}

export function getHalfwayTarget(durationDays: number) {
  if (!Number.isInteger(durationDays) || durationDays < 1) {
    throw new Error("durationDays precisa ser um inteiro positivo.");
  }

  return Math.ceil(durationDays / 2);
}

export function getUnlockedAchievementSlugs(
  input: AchievementCheckInput,
  alreadyUnlocked: Iterable<string> = [],
): AchievementCheckResult {
  assertNonNegativeInteger(input.completedHabitsLifetime, "completedHabitsLifetime");
  assertNonNegativeInteger(input.finalizedDays, "finalizedDays");
  assertNonNegativeInteger(
    input.physicalActivityCompletions,
    "physicalActivityCompletions",
  );
  assertNonNegativeInteger(input.readingCompletions, "readingCompletions");
  assertNonNegativeInteger(input.reflectionDays, "reflectionDays");
  assertNonNegativeInteger(input.streakCurrent, "streakCurrent");

  const unlocked = new Set(alreadyUnlocked);
  const halfwayTarget = getHalfwayTarget(input.durationDays);
  const candidates: Array<[InitialAchievementSlug, boolean]> = [
    ["primeiro-habito", input.completedHabitsLifetime >= 1],
    ["primeiro-dia", input.finalizedDays >= 1],
    ["tres-dias-seguidos", input.streakCurrent >= 3],
    ["primeira-semana", input.finalizedDays >= 7],
    ["sete-leituras", input.readingCompletions >= 7],
    ["sete-atividades-fisicas", input.physicalActivityCompletions >= 7],
    ["sete-reflexoes", input.reflectionDays >= 7],
    ["metade-do-caminho", input.finalizedDays >= halfwayTarget],
    ["retorno-forte", input.returnStrong],
    [
      "missao-concluida",
      input.completedCycle || input.finalizedDays >= input.durationDays,
    ],
  ];

  return {
    unlockedSlugs: candidates
      .filter(([slug, qualifies]) => qualifies && !unlocked.has(slug))
      .map(([slug]) => slug),
  };
}
