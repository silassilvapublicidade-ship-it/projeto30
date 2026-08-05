const PROJECT_TIME_ZONE = "America/Sao_Paulo";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Data curta no padrão do app (DD/MM/AAAA), sempre no fuso America/Sao_Paulo
 * (Parte H) - nunca o fuso do processo Node que renderiza a página, que em
 * produção (Vercel) é UTC. Sem essa âncora explícita, a mesma data podia
 * aparecer diferente no Admin (SSR em UTC) e para o usuário (fuso do
 * navegador), ou até virar o dia errado perto da meia-noite em Brasília.
 * Retorna "—" para valor ausente/inválido, nunca lança.
 */
export function formatProjectDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("pt-BR", { timeZone: PROJECT_TIME_ZONE }) : "—";
}

/** Data + hora curtas no padrão do app, mesma âncora de fuso de {@link formatProjectDate}. */
export function formatProjectDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date
    ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: PROJECT_TIME_ZONE })
    : "—";
}
