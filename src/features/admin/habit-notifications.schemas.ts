import { z } from "zod";

// Mirrors challenge_habit_notifications_frequency_type_check (migration
// 0053). weekly uses `weekdays` (extract(dow from date) convention: 0=dom
// .. 6=sab); monthly uses `monthlyDay` (dia do mes). "Diario"/"somente
// finais de semana"/"somente dias uteis"/"uma vez por semana"/"personalizado"
// (Parte 7) sao todos so combinacoes diferentes de weekdays - nao precisam
// de um frequency_type proprio.
export const HABIT_NOTIFICATION_FREQUENCY_TYPES = ["weekly", "monthly"] as const;

export const WEEKDAY_OPTIONS = [
  { label: "Domingo", value: 0 },
  { label: "Segunda", value: 1 },
  { label: "Terça", value: 2 },
  { label: "Quarta", value: 3 },
  { label: "Quinta", value: 4 },
  { label: "Sexta", value: 5 },
  { label: "Sábado", value: 6 },
] as const;

export const WEEKDAY_PRESETS = {
  daily: [0, 1, 2, 3, 4, 5, 6],
  weekdays: [1, 2, 3, 4, 5],
  weekend: [0, 6],
} as const;

export const habitNotificationFormSchema = z
  .object({
    enabled: z.coerce.boolean().default(false),
    frequencyType: z.enum(HABIT_NOTIFICATION_FREQUENCY_TYPES).default("weekly"),
    monthlyDay: z.coerce.number().int().min(1).max(31).optional(),
    notificationBody: z.string().trim().min(3, "Informe a mensagem.").max(300),
    notificationTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM."),
    notificationTitle: z.string().trim().min(2, "Informe o título.").max(120),
    onlyIfNotCompleted: z.coerce.boolean().default(true),
    priority: z.coerce.number().int().min(1).max(10).default(5),
    weekdays: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  })
  .refine((data) => data.frequencyType !== "monthly" || data.monthlyDay !== undefined, {
    error: "Informe o dia do mês.",
    path: ["monthlyDay"],
  })
  .refine((data) => data.frequencyType !== "weekly" || data.weekdays.length > 0, {
    error: "Selecione ao menos um dia da semana.",
    path: ["weekdays"],
  });

export type HabitNotificationFormInput = z.infer<typeof habitNotificationFormSchema>;

export const habitIdSchema = z.uuid("Identificador de hábito inválido.");
