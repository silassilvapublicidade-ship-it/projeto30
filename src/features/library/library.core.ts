const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;

export const LIBRARY_PILLARS = ["body", "mind", "character", "spirit"] as const;
export type LibraryPillar = (typeof LIBRARY_PILLARS)[number];

export const LIBRARY_PILLAR_LABELS: Record<LibraryPillar, string> = {
  body: "Corpo",
  mind: "Mente",
  character: "Caráter",
  spirit: "Espírito",
};

export function isLibraryPillar(value: string): value is LibraryPillar {
  return (LIBRARY_PILLARS as readonly string[]).includes(value);
}

export const LIBRARY_STATUSES = ["draft", "in_review", "approved", "scheduled", "published", "archived"] as const;
export type LibraryContentStatus = (typeof LIBRARY_STATUSES)[number];

export const LIBRARY_STATUS_LABELS: Record<LibraryContentStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  scheduled: "Agendado",
  published: "Publicado",
  archived: "Arquivado",
};

export function isLibraryContentStatus(value: string): value is LibraryContentStatus {
  return (LIBRARY_STATUSES as readonly string[]).includes(value);
}

export const LIBRARY_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type LibraryDifficulty = (typeof LIBRARY_DIFFICULTIES)[number];

export const LIBRARY_DIFFICULTY_LABELS: Record<LibraryDifficulty, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export const LIBRARY_READING_STATUSES = ["not_started", "reading", "completed"] as const;
export type LibraryReadingStatus = (typeof LIBRARY_READING_STATUSES)[number];

export const LIBRARY_READING_STATUS_LABELS: Record<LibraryReadingStatus, string> = {
  not_started: "Não iniciado",
  reading: "Lendo",
  completed: "Concluído",
};

/**
 * Conteúdos com saúde/fé/Bíblia pedem revisão reforçada (Parte 14) - lista
 * fechada de palavras-gatilho, checada contra título+resumo+tema no
 * formulário de criação. É só um SINAL para o admin marcar a caixa,
 * nunca um bloqueio automático.
 */
const ENHANCED_REVIEW_KEYWORDS = [
  "saúde",
  "saude",
  "alimentação",
  "alimentacao",
  "dieta",
  "treino",
  "exercício",
  "exercicio",
  "emagrec",
  "cura",
  "bíblia",
  "biblia",
  "teologia",
  "oração",
  "oracao",
  "aconselhamento",
  "emocional",
  "mental",
];

export function suggestsEnhancedReview(text: string): boolean {
  const normalized = text.toLowerCase();
  return ENHANCED_REVIEW_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function suggestLibrarySlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(COMBINING_DIACRITICAL_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatReadingTime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "Leitura rápida";
  return `${minutes} min de leitura`;
}
