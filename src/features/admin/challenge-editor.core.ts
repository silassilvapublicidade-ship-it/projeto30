export type ChangeClassification = "editorial" | "structural" | "operational";

/**
 * Classifies every field the editor can touch into one of three buckets,
 * per the lifecycle rule: editorial changes stay free forever; structural
 * changes are blocked once a challenge has any participant; operational
 * changes (status/window/limit) are always allowed but go through their own
 * guarded transitions (see admin-challenges.actions.ts).
 */
const FIELD_CLASSIFICATION: Record<string, ChangeClassification> = {
  allHabitsBonusPoints: "operational",
  allowAbandonment: "operational",
  allowJoinAfterStart: "operational",
  ctaLabel: "editorial",
  ctaSupportingText: "editorial",
  description: "editorial",
  durationDays: "structural",
  enrollmentEnd: "operational",
  enrollmentStart: "operational",
  enrollmentType: "operational",
  endDate: "structural",
  finalizeDayPoints: "operational",
  habits: "structural",
  headline: "editorial",
  heroMessage: "editorial",
  name: "editorial",
  participantLimit: "operational",
  reflectionPoints: "operational",
  shortDescription: "editorial",
  slug: "editorial",
  startDate: "structural",
  streakMinimumCompletion: "operational",
  subheadline: "editorial",
  tagline: "editorial",
  themeCategory: "editorial",
  visualStyle: "editorial",
};

export function classifyChallengeField(field: string): ChangeClassification {
  return FIELD_CLASSIFICATION[field] ?? "structural";
}

export function isFieldChangeAllowed(field: string, hasParticipants: boolean): boolean {
  if (!hasParticipants) {
    return true;
  }

  return classifyChallengeField(field) !== "structural";
}

/**
 * Builds a JSON-safe patch that removes any legacy/superseded keys first,
 * then merges in the new values - never overwrites the whole JSONB column.
 * Mirrors the exact strategy documented in
 * scripts/challenges/create-august-irreconhecivel.sql ("(config_atual -
 * chaves antigas) || novo_delta").
 */
export function mergeJsonConfig<T extends Record<string, unknown>>(
  current: Record<string, unknown> | null | undefined,
  patch: T,
): Record<string, unknown> {
  const base = { ...(current ?? {}) };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete base[key];
      continue;
    }
    base[key] = value;
  }

  return base;
}

const COMBINING_DIACRITICAL_MARKS = /[̀-ͯ]/g;

export function suggestChallengeSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(COMBINING_DIACRITICAL_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type ChallengeValidationInput = {
  durationDays: number;
  generatedDaysCount: number;
  habitsCount: number;
  name: string;
  slug: string;
};

export type ChallengeValidationIssue = string;

/**
 * Pre-publish validation, run again server-side (never trust a client-side
 * "looks valid" state) right before flipping status to active.
 */
export function validateChallengeForPublish(
  input: ChallengeValidationInput,
): ChallengeValidationIssue[] {
  const issues: ChallengeValidationIssue[] = [];

  if (!input.name.trim()) {
    issues.push("O desafio precisa de um nome.");
  }

  if (!input.slug.trim()) {
    issues.push("O desafio precisa de um slug.");
  }

  if (input.habitsCount === 0) {
    issues.push("Adicione pelo menos um hábito antes de publicar.");
  }

  if (input.generatedDaysCount !== input.durationDays) {
    issues.push(
      `Os dias do ciclo (${input.generatedDaysCount}) não coincidem com a duração configurada (${input.durationDays}). Gere a estrutura dos dias novamente.`,
    );
  }

  return issues;
}

// Codepoints de caracteres de controle Unicode a remover de uma mensagem de
// dia, mantendo apenas os dois que tem uso legitimo em texto (codepoint 9 e
// codepoint 10). Construido via String.fromCharCode/RegExp em vez de um
// literal regex com bytes de controle reais dentro do arquivo fonte
// (mais seguro de editar/revisar em qualquer editor).
const KEPT_CONTROL_CODEPOINTS = new Set([9, 10]);
// length: 32 -> codepoints 0..31 (the full C0 control range) - codepoint 32
// is the space character and must never be in this list.
const CONTROL_CHARACTER_CODEPOINTS = Array.from({ length: 32 }, (_, index) => index).filter(
  (code) => !KEPT_CONTROL_CODEPOINTS.has(code),
);
CONTROL_CHARACTER_CODEPOINTS.push(127);
const CONTROL_CHARACTERS_PATTERN = new RegExp(
  `[${CONTROL_CHARACTER_CODEPOINTS.map((code) => String.fromCharCode(code)).join("")}]`,
  "g",
);

/**
 * Sanitiza a mensagem editorial de um dia (Correções obrigatórias
 * pré-lançamento, Parte D) antes de gravar - nunca HTML/JSON livre, so
 * texto puro. React já escapa qualquer caractere ao renderizar (nenhum
 * dangerouslySetInnerHTML consome challenge_days.message em lugar nenhum
 * do app), então o risco real aqui não é XSS de renderização - é conteúdo
 * de controle acidental (bytes de controle, colagem de HTML inteiro,
 * espaços em excesso). Remove tags HTML literais (defesa em profundidade,
 * mesmo sem um sink perigoso hoje), caracteres de controle e normaliza
 * espaços repetidos e quebras de linha em excesso. String vazia após
 * sanitizar é um resultado válido (limpa a mensagem).
 */
export function sanitizeDayMessage(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(CONTROL_CHARACTERS_PATTERN, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function describeChallengeLifecycleStage(
  status: string,
  hasParticipants: boolean,
): "draft" | "published_no_participants" | "published_with_participants" | "ended" {
  if (status === "ended" || status === "archived") {
    return "ended";
  }

  if (status === "draft") {
    return "draft";
  }

  return hasParticipants ? "published_with_participants" : "published_no_participants";
}
