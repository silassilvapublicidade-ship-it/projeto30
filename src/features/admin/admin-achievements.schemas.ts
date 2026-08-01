import { z } from "zod";

/**
 * Closed, typed set of the 10 achievement rule types the real unlock engine
 * understands - see finalize_daily_log() (supabase/migrations/0016) and its
 * TypeScript mirror (src/features/achievements/achievements.core.ts). Each
 * type maps 1:1 to an exact `slug` the SQL loop filters on; a slug outside
 * this list would never be evaluated at all. `ruleConfig` is the exact shape
 * already seeded for that slug since 0002_daily_journey_core.sql - written
 * once on create, never edited afterward, and never accepted as free-form
 * JSON from the client.
 *
 * IMPORTANT (audited, confirmed by reading the engine): the numeric
 * parameters inside ruleConfig (`days`, `count`) are NOT read by
 * finalize_daily_log() - the real thresholds (3 days streak, 7 finalized
 * days, etc.) are hardcoded in the SQL condition, not derived from this
 * jsonb. They're kept here only so a newly created achievement stores the
 * same shape every existing row already has. This module intentionally does
 * NOT expose a way to customize those numbers - doing so would silently
 * suggest a threshold that the engine ignores.
 */
export const ACHIEVEMENT_RULE_TYPES = [
  {
    slug: "primeiro-habito",
    type: "first_habit",
    label: "Primeiro hábito concluído",
    defaultName: "Primeiro hábito",
    defaultDescription: "Concluir o primeiro hábito do ciclo.",
    defaultIcon: "sparkles",
    ruleConfig: { type: "first_habit" },
  },
  {
    slug: "primeiro-dia",
    type: "first_day",
    label: "Primeiro dia concluído",
    defaultName: "Primeiro dia",
    defaultDescription: "Concluir o primeiro dia do ciclo.",
    defaultIcon: "sunrise",
    ruleConfig: { type: "first_day" },
  },
  {
    slug: "tres-dias-seguidos",
    type: "streak",
    label: "Sequência de 3 dias",
    defaultName: "Três dias seguidos",
    defaultDescription: "Manter uma sequência de 3 dias.",
    defaultIcon: "flame",
    ruleConfig: { type: "streak", days: 3 },
  },
  {
    slug: "primeira-semana",
    type: "finalized_days",
    label: "7 dias concluídos",
    defaultName: "Primeira semana",
    defaultDescription: "Concluir 7 dias do ciclo.",
    defaultIcon: "calendar-check",
    ruleConfig: { type: "finalized_days", days: 7 },
  },
  {
    slug: "sete-leituras",
    type: "reading_completions",
    label: "7 leituras concluídas",
    defaultName: "Sete leituras",
    defaultDescription: "Concluir 7 hábitos de leitura.",
    defaultIcon: "book-open",
    ruleConfig: { type: "reading_completions", count: 7 },
  },
  {
    slug: "sete-atividades-fisicas",
    type: "physical_activity_completions",
    label: "7 atividades físicas concluídas",
    defaultName: "Sete atividades físicas",
    defaultDescription: "Concluir 7 hábitos de atividade física.",
    defaultIcon: "activity",
    ruleConfig: { type: "physical_activity_completions", count: 7 },
  },
  {
    slug: "sete-reflexoes",
    type: "reflection_days",
    label: "7 reflexões registradas",
    defaultName: "Sete reflexões",
    defaultDescription: "Registrar 7 reflexões no diário.",
    defaultIcon: "pen-line",
    ruleConfig: { type: "reflection_days", count: 7 },
  },
  {
    slug: "metade-do-caminho",
    type: "halfway",
    label: "Metade do desafio",
    defaultName: "Metade do caminho",
    defaultDescription: "Chegar à metade do ciclo.",
    defaultIcon: "route",
    ruleConfig: { type: "halfway" },
  },
  {
    slug: "retorno-forte",
    type: "return_after_break",
    label: "Retorno após pausa",
    defaultName: "Retorno forte",
    defaultDescription: "Retomar o ciclo após perder um dia.",
    defaultIcon: "rotate-ccw",
    ruleConfig: { type: "return_after_break" },
  },
  {
    slug: "missao-concluida",
    type: "challenge_completed",
    label: "Desafio concluído",
    defaultName: "Missão concluída",
    defaultDescription: "Concluir o desafio inteiro.",
    defaultIcon: "trophy",
    ruleConfig: { type: "challenge_completed" },
  },
] as const;

export type AchievementRuleType = (typeof ACHIEVEMENT_RULE_TYPES)[number]["type"];

const ACHIEVEMENT_RULE_TYPE_VALUES = ACHIEVEMENT_RULE_TYPES.map((rule) => rule.type) as [
  AchievementRuleType,
  ...AchievementRuleType[],
];

export function getAchievementRuleDefinition(type: string) {
  return ACHIEVEMENT_RULE_TYPES.find((rule) => rule.type === type);
}

export function getAchievementRuleDefinitionBySlug(slug: string) {
  return ACHIEVEMENT_RULE_TYPES.find((rule) => rule.slug === slug);
}

/**
 * Convention followed by every real seeded achievement (scripts/challenges,
 * scripts/validation, 0002_daily_journey_core.sql): a lucide-react icon name
 * in kebab-case. Fixed picker instead of free text so a typo never produces
 * a silently-broken icon reference.
 */
export const ACHIEVEMENT_ICONS = [
  "sparkles",
  "sunrise",
  "flame",
  "calendar-check",
  "book-open",
  "activity",
  "pen-line",
  "route",
  "rotate-ccw",
  "trophy",
  "medal",
  "star",
  "award",
  "gem",
  "crown",
  "zap",
] as const;

export const achievementIdSchema = z.uuid("Identificador de conquista inválido.");

export const achievementCreateSchema = z.object({
  category: z.string().trim().max(60).optional(),
  challengeId: z.uuid("Selecione um desafio."),
  description: z.string().trim().max(280).optional(),
  icon: z.enum(ACHIEVEMENT_ICONS).optional(),
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres.").max(120),
  pointsBonus: z.coerce.number().int().min(0).max(10000).default(0),
  rarity: z.string().trim().max(60).optional(),
  ruleType: z.enum(ACHIEVEMENT_RULE_TYPE_VALUES, "Selecione um tipo de regra."),
  shareMessage: z.string().trim().max(200).optional(),
  shareTitle: z.string().trim().max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type AchievementCreateInput = z.infer<typeof achievementCreateSchema>;

export const achievementUpdateSchema = z.object({
  active: z.coerce.boolean().default(true),
  category: z.string().trim().max(60).optional(),
  description: z.string().trim().max(280).optional(),
  icon: z.enum(ACHIEVEMENT_ICONS).optional(),
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres.").max(120),
  pointsBonus: z.coerce.number().int().min(0).max(10000).default(0),
  rarity: z.string().trim().max(60).optional(),
  shareMessage: z.string().trim().max(200).optional(),
  shareTitle: z.string().trim().max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type AchievementUpdateInput = z.infer<typeof achievementUpdateSchema>;

export const achievementPreviewSchema = z.object({
  category: z.string().trim().max(60).optional(),
  challengeName: z.string().trim().max(160).optional(),
  description: z.string().trim().max(280).optional(),
  format: z.enum(["story", "feed"]).default("feed"),
  name: z.string().trim().min(1).max(120),
  rarity: z.string().trim().max(60).optional(),
  shareMessage: z.string().trim().max(200).optional(),
  shareTitle: z.string().trim().max(120).optional(),
});
