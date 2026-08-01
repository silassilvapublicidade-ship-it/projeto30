type AmrEntry = { method?: string } | string;

/**
 * Supabase's `amr` (Authentication Methods Reference) claim lists every auth
 * method used for the current session, oldest first. Only a session whose
 * most recent method was a real password grant has a "senha atual" to
 * reauthenticate against - magic link, recovery and OTP sessions never had
 * one, so skipping the field there isn't a shortcut, it's the only correct
 * behavior. Defaults to false (skip reauth) when the claim is missing or
 * malformed, matching this codebase's fail-open resilience pattern rather
 * than blocking the user on an infrastructure hiccup.
 */
export function requiresPasswordReauth(amr: unknown): boolean {
  if (!Array.isArray(amr) || amr.length === 0) {
    return false;
  }

  const lastEntry = amr[amr.length - 1] as AmrEntry;
  const method = typeof lastEntry === "string" ? lastEntry : lastEntry?.method;

  return method === "password";
}
