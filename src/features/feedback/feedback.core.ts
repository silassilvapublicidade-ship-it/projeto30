/**
 * Feedback privado do usuário (Parte C). Regras puras - tipos, categorias
 * por tipo, labels humanizados exatos pedidos pelo usuário. Nunca chat,
 * nunca central de tickets complexa: só o vocabulário fixo abaixo.
 */
export const FEEDBACK_TYPES = ["problem", "suggestion", "rating"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  problem: "Relatar problema",
  suggestion: "Enviar sugestão",
  rating: "Avaliar experiência",
};

export function isFeedbackType(value: string): value is FeedbackType {
  return (FEEDBACK_TYPES as readonly string[]).includes(value);
}

export const PROBLEM_CATEGORIES = [
  "nao_funcionou",
  "erro_visual",
  "nao_salvou",
  "tela_nao_carregou",
  "notificacao",
  "compartilhamento",
  "outro",
] as const;

export const SUGGESTION_CATEGORIES = ["melhoria", "conteudo", "facilidade_uso", "nova_ideia", "outro"] as const;

export type FeedbackCategory = (typeof PROBLEM_CATEGORIES)[number] | (typeof SUGGESTION_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  nao_funcionou: "Algo não funcionou",
  erro_visual: "Erro visual",
  nao_salvou: "Ação não salvou",
  tela_nao_carregou: "Tela não carregou",
  notificacao: "Notificação",
  compartilhamento: "Compartilhamento",
  melhoria: "Melhoria",
  conteudo: "Conteúdo",
  facilidade_uso: "Facilidade de uso",
  nova_ideia: "Nova ideia",
  outro: "Outro",
};

export function categoriesForType(type: FeedbackType): readonly FeedbackCategory[] {
  if (type === "problem") return PROBLEM_CATEGORIES;
  if (type === "suggestion") return SUGGESTION_CATEGORIES;
  return [];
}

export const FEEDBACK_SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type FeedbackSentiment = (typeof FEEDBACK_SENTIMENTS)[number];

export const FEEDBACK_SENTIMENT_LABELS: Record<FeedbackSentiment, string> = {
  positive: "Positiva",
  neutral: "Neutra",
  negative: "Negativa",
};

export const FEEDBACK_STATUSES = ["new", "reviewing", "planned", "resolved", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Wording exato pedido pelo usuário - não parafrasear. */
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Novo",
  reviewing: "Em análise",
  planned: "Planejado",
  resolved: "Resolvido",
  closed: "Encerrado",
};

export const FEEDBACK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

export const FEEDBACK_PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export function isFeedbackPriority(value: string): value is FeedbackPriority {
  return (FEEDBACK_PRIORITIES as readonly string[]).includes(value);
}

export const FEEDBACK_PRIVACY_NOTICE =
  "Seu feedback será usado para melhorar a plataforma. Dados técnicos opcionais ajudam a identificar o problema e não incluem senha, diário ou conteúdo privado.";

export const FEEDBACK_ATTACHMENT_PRIVACY_NOTICE =
  "Revise a imagem antes de enviar para garantir que ela não contenha informações pessoais.";

export const FEEDBACK_SUBMITTED_MESSAGE = "Obrigado por ajudar a melhorar o Projeto 30.";

export const FEEDBACK_DELETE_CONFIRMATION_PHRASE = "EXCLUIR FEEDBACK";

export const FEEDBACK_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const FEEDBACK_TITLE_MAX_LENGTH = 200;
export const FEEDBACK_DESCRIPTION_MAX_LENGTH = 4000;

/** Contexto técnico automático - somente estes campos, nunca mais. */
export type FeedbackTechnicalContext = {
  route: string;
  appVersion: string | null;
  browser: string | null;
  operatingSystem: string | null;
  isPwa: boolean;
  viewport: string;
  diagnosticCode: string | null;
};
