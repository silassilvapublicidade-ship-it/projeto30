import type { ReactNode } from "react";

/**
 * Deliberately its own route group, separate from (public)'s marketing
 * chrome (PublicHeader/PublicFooter). Those carry landing-page anchor links
 * (#produto, #evolucao...) and a "Começar meu Dia 1" CTA that make no sense
 * on a screen whose entire purpose is signing in, and their extra vertical
 * space works directly against a premium, no-scroll, viewport-filling
 * layout. URLs are unaffected - route groups don't appear in the path, so
 * /login, /cadastro, /recuperar-senha and /nova-senha are unchanged.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>;
}
