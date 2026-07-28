import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import {
  MemberDesktopNavigation,
  MemberMobileNavigation,
} from "@/components/member/member-navigation";
import { Button } from "@/components/ui/button";
import { signOutAndRedirectAction } from "@/features/auth/auth.actions";
import type { MemberContext } from "@/server/services/member-area.service";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function MemberShell({
  children,
  context,
}: {
  children: ReactNode;
  context: MemberContext;
}) {
  const displayName =
    context.profile.display_name || context.profile.name || context.profile.email;
  const initials = getInitials(displayName) || "P30";
  const cycleLabel = context.activeEnrollment?.challenge
    ? `Dia ${context.activeEnrollment.current_day}`
    : "Sem ciclo ativo";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]" />
      <div className="mx-auto grid min-h-screen w-full max-w-[1360px] md:grid-cols-[16.5rem_1fr]">
        <aside className="sticky top-0 hidden h-screen px-4 py-5 md:block">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-3 shadow-[var(--shadow-hairline)]">
              <BrandLogo decorative preload size={40} />
              <span>
                <span className="block text-sm font-semibold">Projeto 30</span>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">
                  Area de membros
                </span>
              </span>
            </div>

            <div className="mt-6">
              <MemberDesktopNavigation />
            </div>

            <div className="mt-auto space-y-3">
              <div className="rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-4">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
                  Ciclo
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{cycleLabel}</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {context.activeEnrollment?.challenge?.name ??
                    "Entre em um ciclo para começar com calma."}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-mono text-xs text-foreground shadow-[var(--shadow-hairline)]">
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </span>
                  <span className="block truncate text-xs text-muted-2">
                    {context.profile.email}
                  </span>
                </span>
              </div>

              <form action={signOutAndRedirectAction}>
                <Button
                  className="w-full"
                  leadingIcon={<LogOut aria-hidden="true" size={15} />}
                  type="submit"
                  variant="ghost"
                >
                  Sair
                </Button>
              </form>
            </div>
          </div>
        </aside>

        <div className="min-w-0 pb-24 md:pb-0">
          <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/82 px-4 py-3 backdrop-blur-2xl md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-action-soft">
                  {cycleLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {displayName}
                </p>
              </div>
              <form action={signOutAndRedirectAction}>
                <Button
                  aria-label="Sair"
                  leadingIcon={<LogOut aria-hidden="true" size={15} />}
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  Sair
                </Button>
              </form>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-12">
            {children}
          </main>
        </div>
      </div>
      <MemberMobileNavigation />
    </div>
  );
}
