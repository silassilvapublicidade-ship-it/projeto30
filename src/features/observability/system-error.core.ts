export const SYSTEM_ERROR_AREAS = [
  "auth",
  "onboarding",
  "desafios",
  "habitos",
  "finalizacao",
  "conquistas",
  "compartilhamentos",
  "dicas",
  "uploads",
  "notificacoes",
  "cron",
  "admin",
  "pwa",
  "app",
] as const;

export type SystemErrorArea = (typeof SYSTEM_ERROR_AREAS)[number];

export const SYSTEM_ERROR_AREA_LABELS: Record<SystemErrorArea, string> = {
  auth: "Autenticação",
  onboarding: "Onboarding",
  desafios: "Desafios",
  habitos: "Hábitos",
  finalizacao: "Finalização",
  conquistas: "Conquistas",
  compartilhamentos: "Compartilhamentos",
  dicas: "Dicas",
  uploads: "Uploads",
  notificacoes: "Notificações",
  cron: "Cron",
  admin: "Admin",
  pwa: "PWA",
  app: "Área de membros",
};

export function isSystemErrorArea(value: string): value is SystemErrorArea {
  return (SYSTEM_ERROR_AREAS as readonly string[]).includes(value);
}

export const SYSTEM_ERROR_SEVERITIES = ["info", "warning", "error", "critical"] as const;

export type SystemErrorSeverity = (typeof SYSTEM_ERROR_SEVERITIES)[number];

export const SYSTEM_ERROR_SEVERITY_LABELS: Record<SystemErrorSeverity, string> = {
  info: "Informativo",
  warning: "Atenção",
  error: "Erro",
  critical: "Crítico",
};

export const SYSTEM_ERROR_STATUSES = ["open", "investigating", "resolved"] as const;

export type SystemErrorStatus = (typeof SYSTEM_ERROR_STATUSES)[number];

export const SYSTEM_ERROR_STATUS_LABELS: Record<SystemErrorStatus, string> = {
  open: "Em aberto",
  investigating: "Investigando",
  resolved: "Resolvido",
};

/**
 * Postgres error codes já mapeados no restante do app (journey-rpc-error.core.ts,
 * challenge-catalog.actions.ts) representam falhas de validação/regra de
 * negócio isoladas e recuperáveis - a própria definição de WARNING (Parte
 * M). Qualquer código fora dessa lista é tratado como ERROR: a
 * funcionalidade genuinamente não foi concluída para o usuário. CRITICAL
 * nunca é inferido automaticamente por código - é sempre uma escolha
 * explícita de quem chama recordSystemError.
 */
const RECOVERABLE_POSTGRES_CODES = new Set([
  "42501",
  "22023",
  "23505",
  "P0002",
  "P0003",
  "P0004",
  "P0005",
  "P0006",
  "P0007",
  "P0008",
]);

export function mapPostgresCodeToSeverity(code: string | null | undefined): SystemErrorSeverity {
  if (code && RECOVERABLE_POSTGRES_CODES.has(code)) {
    return "warning";
  }
  return "error";
}

/**
 * Mesmo padrão usado na função SQL _system_error_text_is_safe - mantido em
 * dois lugares de propósito (defesa em profundidade: TS filtra antes de
 * chamar a RPC, a RPC filtra de novo antes de gravar).
 */
const FORBIDDEN_PATTERN =
  /(password|senha|token|cookie|authorization|service_role|api[_-]?key|[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

export function containsForbiddenPattern(text: string): boolean {
  return FORBIDDEN_PATTERN.test(text);
}

const CONTROL_CHARS = Array.from({ length: 32 }, (_, index) => String.fromCharCode(index)).join("");
const CONTROL_CHARS_PATTERN = new RegExp(`[${CONTROL_CHARS}]`, "g");

export function sanitizeErrorText(text: string, maxLength = 500): string {
  const stripped = text.replace(CONTROL_CHARS_PATTERN, " ").replace(/\s+/g, " ").trim();
  return stripped.slice(0, maxLength);
}

export type SafeMetadataValue = string | number | boolean | null;
export type SafeMetadata = Record<string, SafeMetadataValue>;

const MAX_METADATA_KEYS = 12;
const MAX_METADATA_VALUE_LENGTH = 200;
const MAX_METADATA_BYTES = 2000;

/**
 * Whitelist estrutural, não de nomes de campo: só aceita valores
 * primitivos (nunca objetos/arrays aninhados, que poderiam esconder um
 * payload inteiro), corta o número de chaves e o tamanho de cada valor, e
 * descarta qualquer par cuja chave OU valor bata no padrão proibido.
 * Nunca lança - metadata inválida vira metadata vazia, nunca bloqueia o
 * registro do erro em si.
 */
export function sanitizeMetadata(input: Record<string, unknown> | null | undefined): SafeMetadata {
  if (!input || typeof input !== "object") {
    return {};
  }

  const result: SafeMetadata = {};
  let keyCount = 0;

  for (const [key, rawValue] of Object.entries(input)) {
    if (keyCount >= MAX_METADATA_KEYS) break;
    if (containsForbiddenPattern(key)) continue;

    let value: SafeMetadataValue;
    if (rawValue === null || typeof rawValue === "boolean" || typeof rawValue === "number") {
      value = rawValue;
    } else if (typeof rawValue === "string") {
      const trimmed = sanitizeErrorText(rawValue, MAX_METADATA_VALUE_LENGTH);
      if (containsForbiddenPattern(trimmed)) continue;
      value = trimmed;
    } else {
      // objetos/arrays/undefined/funções: nunca repassados.
      continue;
    }

    result[key] = value;
    keyCount += 1;
  }

  while (Buffer.byteLength(JSON.stringify(result), "utf8") > MAX_METADATA_BYTES) {
    const keys = Object.keys(result);
    const lastKey = keys.at(-1);
    if (!lastKey) break;
    delete result[lastKey];
  }

  return result;
}

export type DiagnosticCopyContent = {
  errorCode: string;
  occurredAt: string;
  route: string | null;
  operation: string;
  messageSafe: string;
  appVersion: string | null;
  userAgent?: string | null;
};

/**
 * Texto pronto para o botão "Copiar diagnóstico" (Parte D) - exatamente os
 * campos permitidos, nada de user_id/postgres_code/metadata.
 */
export function buildDiagnosticCopyText(content: DiagnosticCopyContent): string {
  const lines = [
    `Código: ${content.errorCode}`,
    `Data/hora: ${content.occurredAt}`,
    `Rota: ${content.route ?? "não informada"}`,
    `Operação: ${content.operation}`,
    `Mensagem: ${content.messageSafe}`,
    `Versão do sistema: ${content.appVersion ?? "desconhecida"}`,
  ];

  if (content.userAgent) {
    lines.push(`Navegador: ${content.userAgent}`);
  }

  return lines.join("\n");
}
