import { z } from "zod";

// Mirrors daily_motivation_messages_category_check (migration 0053).
// Categorias pedidas literalmente na Parte 3, "fe" e a categoria de fe
// crista da Parte 4 (mesma tabela, nunca uma estrutura paralela).
export const DAILY_MOTIVATION_CATEGORIES = [
  "disciplina",
  "fe",
  "perseveranca",
  "constancia",
  "gratidao",
  "superacao",
  "proposito",
  "geral",
] as const;

export type DailyMotivationCategory = (typeof DAILY_MOTIVATION_CATEGORIES)[number];

export const DAILY_MOTIVATION_CATEGORY_LABELS: Record<DailyMotivationCategory, string> = {
  disciplina: "Disciplina",
  fe: "Fé",
  perseveranca: "Perseverança",
  constancia: "Constância",
  gratidao: "Gratidão",
  superacao: "Superação",
  proposito: "Propósito",
  geral: "Geral",
};

export const dailyMotivationMessageFormSchema = z
  .object({
    active: z.coerce.boolean().default(true),
    body: z.string().trim().min(3, "Informe a mensagem.").max(500),
    category: z.enum(DAILY_MOTIVATION_CATEGORIES, "Selecione uma categoria."),
    endsAt: z.string().trim().optional(),
    priority: z.coerce.number().int().min(1).max(10).default(5),
    startsAt: z.string().trim().optional(),
    title: z.string().trim().min(2, "Informe um título.").max(120),
  })
  .refine((data) => !data.startsAt || !data.endsAt || data.startsAt <= data.endsAt, {
    error: "O fim da janela precisa ser igual ou depois do início.",
    path: ["endsAt"],
  });

export type DailyMotivationMessageFormInput = z.infer<typeof dailyMotivationMessageFormSchema>;

export const dailyMotivationMessageIdSchema = z.uuid("Identificador de mensagem inválido.");
