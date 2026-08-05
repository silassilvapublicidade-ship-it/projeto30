/**
 * The single allowlist of internal destinations a notification (push or
 * in-app) is ever allowed to open. Shared by: the admin compositor (picker
 * + server-side validation), the DB CHECK constraints (notifications /
 * notification_campaigns.destination_type, kept in sync by hand - see
 * migration 0041), the service worker's notificationclick handler, and the
 * in-app inbox's click handler. A destination_type outside this list can
 * never be stored, and a URL is only ever built from this map - never from
 * a free-form string - so there is no open-redirect surface anywhere in
 * the notification pipeline.
 */
export const NOTIFICATION_DESTINATION_TYPES = [
  "hoje",
  "desafios",
  "desafio",
  "jornada",
  "dicas",
  "dica",
  "conquistas",
  "notificacoes",
  "configuracoes_notificacoes",
  "feedback",
] as const;

export type NotificationDestinationType = (typeof NOTIFICATION_DESTINATION_TYPES)[number];

/** Which destination types require a reference id (a slug) to resolve a full path. */
const REFERENCE_REQUIRED: ReadonlySet<NotificationDestinationType> = new Set(["desafio", "dica"]);

export function destinationRequiresReference(type: NotificationDestinationType): boolean {
  return REFERENCE_REQUIRED.has(type);
}

export const NOTIFICATION_DESTINATION_LABELS: Record<NotificationDestinationType, string> = {
  hoje: "Hoje",
  desafios: "Desafios",
  desafio: "Um desafio específico",
  jornada: "Jornada",
  dicas: "Dicas",
  dica: "Uma dica específica",
  conquistas: "Conquistas",
  notificacoes: "Central de notificações",
  configuracoes_notificacoes: "Configurações de notificações",
  feedback: "Meus feedbacks",
};

/**
 * Builds the actual app-relative path for a destination. Returns null when
 * a reference-requiring type has no (or an unsafe) reference id, rather
 * than falling back to a generic path - callers must treat null as "do not
 * navigate", never silently redirect somewhere else.
 */
export function resolveNotificationDestinationPath(
  type: string | null | undefined,
  referenceId: string | null | undefined,
): string | null {
  if (!isNotificationDestinationType(type)) {
    return null;
  }

  const trimmedReference = referenceId?.trim() || null;

  switch (type) {
    case "hoje":
      return "/app/hoje";
    case "desafios":
      return "/app/desafios";
    case "desafio":
      return trimmedReference && isSafeSlug(trimmedReference)
        ? `/app/desafios/${trimmedReference}`
        : null;
    case "jornada":
      return "/app/jornada";
    case "dicas":
      return "/app/dicas";
    case "dica":
      return trimmedReference && isSafeSlug(trimmedReference) ? `/app/dicas/${trimmedReference}` : null;
    case "conquistas":
      return "/app/conquistas";
    case "notificacoes":
      return "/app/notificacoes";
    case "configuracoes_notificacoes":
      return "/app/configuracoes/notificacoes";
    case "feedback":
      return "/app/feedback/meus";
    default:
      return null;
  }
}

export function isNotificationDestinationType(value: unknown): value is NotificationDestinationType {
  return (
    typeof value === "string" &&
    (NOTIFICATION_DESTINATION_TYPES as readonly string[]).includes(value)
  );
}

// A slug is always a short, lowercase, hyphenated identifier we ourselves
// generated (challenges.slug / content_items well-known slug format) -
// never accept anything containing a scheme, a slash, or dot-segments,
// which is what would allow an open redirect if this guard were skipped.
function isSafeSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$|^[a-z0-9]$/.test(value);
}
