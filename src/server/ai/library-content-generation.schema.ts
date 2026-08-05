import { z } from "zod";

/**
 * "O tom cristão não pode ser obrigatório" - a lista existe para restringir
 * as opções do admin a um vocabulário fechado (nunca texto livre), mas
 * nenhuma delas é selecionada por padrão no formulário.
 */
export const LIBRARY_GENERATION_TONES = [
  "motivacional",
  "educativo",
  "acolhedor",
  "contemplativo",
  "direto",
  "cristao",
  "pratico",
] as const;
export type LibraryGenerationTone = (typeof LIBRARY_GENERATION_TONES)[number];

export const LIBRARY_GENERATION_TONE_LABELS: Record<LibraryGenerationTone, string> = {
  motivacional: "Motivacional",
  educativo: "Educativo",
  acolhedor: "Acolhedor",
  contemplativo: "Contemplativo",
  direto: "Direto",
  cristao: "Cristão",
  pratico: "Prático",
};

/**
 * Shape estrutural da Parte 12 (validado com Zod antes de qualquer coisa
 * ser salva). bible_reference/bible_excerpt aparecem aqui só para não
 * quebrar caso o modelo os inclua mesmo assim - o service que consome este
 * schema DESCARTA os dois campos sempre (Parte 16: nunca publicar trecho
 * bíblico inventado), nunca os grava.
 */
export const libraryContentGenerationOutputSchema = z.object({
  bible_excerpt: z.string().max(1000).nullable().optional(),
  bible_reference: z.string().max(80).nullable().optional(),
  body_sections: z.array(z.string().min(1).max(4000)).min(1).max(12),
  card_copy: z.string().max(280).nullable().optional(),
  estimated_reading_minutes: z.number().int().min(1).max(60).nullable().optional(),
  final_message: z.string().max(1000).nullable().optional(),
  introduction: z.string().max(2000).nullable().optional(),
  notification_copy: z.string().max(180).nullable().optional(),
  practical_application: z.string().max(2000).nullable().optional(),
  reflection_question: z.string().max(500).nullable().optional(),
  small_action: z.string().max(500).nullable().optional(),
  subtitle: z.string().max(200).nullable().optional(),
  suggested_category: z.string().max(80).nullable().optional(),
  suggested_pillar: z.enum(["body", "mind", "character", "spirit"]),
  summary: z.string().max(400).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  title: z.string().min(3).max(160),
});

export type LibraryContentGenerationOutput = z.infer<typeof libraryContentGenerationOutputSchema>;
