export type DisplayNameSource = {
  display_name?: string | null;
  email?: string | null;
  name?: string | null;
};

/**
 * Fallback único de nome de exibição (Parte H) - display_name, depois name,
 * depois email, nunca uma tela em branco quando os três estiverem vazios.
 * Mesma ordem usada em toda a área de membro e no Admin; substituindo as
 * ~7 cópias manuais confirmadas do mesmo encadeamento.
 */
export function resolveUserDisplayName(source: DisplayNameSource | null | undefined): string {
  if (!source) return "Usuário";
  return source.display_name || source.name || source.email || "Usuário";
}
