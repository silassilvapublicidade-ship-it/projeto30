import { z } from "zod";

// Tipos de habito que a engine (public.update_habit_log, ver
// supabase/migrations/0002_daily_journey_core.sql) realmente sabe processar
// hoje. O enum public.habit_type no banco tambem lista "text",
// "single_choice", "multiple_choice", mas update_habit_log rejeita
// explicitamente qualquer um desses ("Tipo de habito ainda nao suportado
// nesta jornada") - o editor nao pode oferecer um tipo que criaria um
// habito impossivel de concluir.
export const SUPPORTED_HABIT_TYPES = ["boolean", "quantity", "duration", "reading"] as const;
export type SupportedHabitType = (typeof SUPPORTED_HABIT_TYPES)[number];

export const HABIT_FREQUENCY_TYPES = ["daily", "weekly", "monthly"] as const;

export const challengeIdentitySchema = z.object({
  ctaLabel: z.string().trim().max(60).optional(),
  ctaSupportingText: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  headline: z.string().trim().max(120).optional(),
  heroMessage: z.string().trim().max(300).optional(),
  name: z.string().trim().min(3, "Informe um nome com pelo menos 3 caracteres.").max(120),
  shortDescription: z.string().trim().max(220).optional(),
  slug: z
    .string()
    .trim()
    .min(3, "Informe um slug com pelo menos 3 caracteres.")
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  subheadline: z.string().trim().max(160).optional(),
  tagline: z.string().trim().max(160).optional(),
  themeCategory: z.string().trim().max(60).optional(),
  visualStyle: z.string().trim().max(60).optional(),
});

export type ChallengeIdentityInput = z.infer<typeof challengeIdentitySchema>;

export const challengeCalendarSchema = z
  .object({
    durationDays: z.coerce.number().int().min(1).max(366),
    enrollmentEnd: z.string().trim().optional(),
    enrollmentStart: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.startDate <= data.endDate, {
    error: "A data final precisa ser igual ou depois da data inicial.",
    path: ["endDate"],
  })
  .refine(
    (data) =>
      !data.enrollmentStart || !data.enrollmentEnd || data.enrollmentStart <= data.enrollmentEnd,
    {
      error: "O fim das inscrições precisa ser igual ou depois do início.",
      path: ["enrollmentEnd"],
    },
  );

export type ChallengeCalendarInput = z.infer<typeof challengeCalendarSchema>;

export const challengeRulesSchema = z.object({
  allHabitsBonusPoints: z.coerce.number().int().min(0).max(1000).optional(),
  allowAbandonment: z.coerce.boolean().default(true),
  allowJoinAfterStart: z.coerce.boolean().default(true),
  enrollmentType: z.enum(["open"]).default("open"),
  finalizeDayPoints: z.coerce.number().int().min(0).max(1000).optional(),
  participantLimit: z.coerce.number().int().min(1).max(1_000_000).optional(),
  reflectionPoints: z.coerce.number().int().min(0).max(1000).optional(),
  streakMinimumCompletion: z.coerce.number().min(0).max(100).optional(),
});

export type ChallengeRulesInput = z.infer<typeof challengeRulesSchema>;

const habitValidationConfigSchema = z.object({
  label: z.string().trim().max(160).optional(),
  target: z.coerce.number().positive().optional(),
  unit: z.string().trim().max(40).optional(),
});

export const habitSchema = z
  .object({
    category: z.string().trim().max(60).optional(),
    description: z.string().trim().max(400).optional(),
    frequencyType: z.enum(HABIT_FREQUENCY_TYPES).default("daily"),
    habitType: z.enum(SUPPORTED_HABIT_TYPES),
    icon: z.string().trim().max(60).optional(),
    isRequired: z.coerce.boolean().default(true),
    points: z.coerce.number().int().min(0).max(1000).default(10),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
    title: z.string().trim().min(2, "Informe um título com pelo menos 2 caracteres.").max(120),
    validationConfig: habitValidationConfigSchema.default({}),
  })
  .refine(
    (data) =>
      !["quantity", "duration"].includes(data.habitType) || data.validationConfig.target !== undefined,
    {
      error: "Informe a meta (quantidade/duração) para este tipo de hábito.",
      path: ["validationConfig", "target"],
    },
  );

export type HabitInput = z.infer<typeof habitSchema>;

export const challengeIdParamSchema = z.uuid("Identificador de desafio inválido.");
export const habitIdParamSchema = z.uuid("Identificador de hábito inválido.");

// Mirrors habits_visibility_config_check (migration 0050) - the 6 types the
// engine actually understands. "Uma versao robusta primeiro": nao oferece
// dias da semana/mensal/condicional/calendario manual do briefing original,
// que o schema atual nao modela ainda.
export const HABIT_VISIBILITY_TYPES = [
  "all_days",
  "first_day",
  "last_day",
  "from_day",
  "between_days",
  "specific_days",
] as const;

export const habitVisibilityFormSchema = z
  .object({
    betweenFrom: z.coerce.number().int().min(1).max(366).optional(),
    betweenTo: z.coerce.number().int().min(1).max(366).optional(),
    fromDay: z.coerce.number().int().min(1).max(366).optional(),
    specificDays: z.string().trim().max(400).optional(),
    type: z.enum(HABIT_VISIBILITY_TYPES),
  })
  .transform((data) => {
    switch (data.type) {
      case "from_day":
        return { day: data.fromDay ?? 1, type: "from_day" as const };
      case "between_days":
        return {
          from: data.betweenFrom ?? 1,
          to: data.betweenTo ?? data.betweenFrom ?? 1,
          type: "between_days" as const,
        };
      case "specific_days":
        return {
          days: (data.specificDays ?? "")
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0),
          type: "specific_days" as const,
        };
      default:
        return { type: data.type };
    }
  })
  .refine((data) => data.type !== "between_days" || ("from" in data && data.from <= data.to), {
    error: "O dia inicial precisa ser igual ou anterior ao dia final.",
    path: ["betweenTo"],
  })
  .refine((data) => data.type !== "specific_days" || ("days" in data && data.days.length > 0), {
    error: "Informe ao menos um dia (ex.: 1, 31).",
    path: ["specificDays"],
  });
