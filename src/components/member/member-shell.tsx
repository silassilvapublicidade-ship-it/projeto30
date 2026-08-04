import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { MemberAvatar } from "@/components/member/member-avatar";
import {
  MemberDesktopNavigation,
  MemberMobileNavigation,
} from "@/components/member/member-navigation";
import { NotificationBellLink } from "@/components/member/notification-bell-link";
import { SignOutForm } from "@/components/member/sign-out-form";
import { Button } from "@/components/ui/button";
import { isAdminRole } from "@/features/admin/admin-access.core";
import type { MemberContext } from "@/server/services/member-area.service";

export function MemberShell({
  children,
  context,
  unreadNotificationCount,
}: {
  children: ReactNode;
  context: MemberContext;
  unreadNotificationCount: number;
}) {
  const displayName =
    context.profile.display_name || context.profile.name || context.profile.email;
  const enrollmentCount = context.enrollments.length;
  const firstEnrollment = context.enrollments[0]?.enrollment ?? null;
  const cycleLabel =
    enrollmentCount === 0
      ? "Sem ciclo ativo"
      : enrollmentCount === 1
        ? `Dia ${firstEnrollment?.current_day}`
        : `${enrollmentCount} desafios ativos`;
  const cycleSubLabel =
    enrollmentCount === 0
      ? "Entre em um ciclo para começar com calma."
      : enrollmentCount === 1
        ? (firstEnrollment?.challenge?.name ?? "Ciclo ativo")
        : "Veja cada um na tela Hoje.";
  const showAdminAccess = isAdminRole(context.profile.role);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]" />
      <div className="safe-x mx-auto grid min-h-dvh w-full max-w-[1360px] md:grid-cols-[16.5rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh px-4 py-5 md:block">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-3 shadow-[var(--shadow-hairline)]">
              <BrandLogo decorative preload size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Projeto 30</span>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">
                  Area de membros
                </span>
              </span>
              <NotificationBellLink unreadCount={unreadNotificationCount} />
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
                <p className="mt-1 text-xs leading-5 text-muted">{cycleSubLabel}</p>
              </div>

              <Link
                aria-label="Abrir perfil e configurações"
                className="flex items-center gap-3 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-3 transition-colors hover:border-white/14 hover:bg-white/[0.05] focus-visible:outline-action-soft"
                href="/app/perfil/editar"
              >
                <MemberAvatar avatarUrl={context.profile.avatar_url} name={displayName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </span>
                  <span className="block truncate text-xs text-muted-2">
                    {context.profile.email}
                  </span>
                </span>
              </Link>

              {showAdminAccess ? (
                <Button
                  as="a"
                  className="w-full"
                  href="/admin"
                  leadingIcon={<ShieldCheck aria-hidden="true" size={15} />}
                  variant="secondary"
                >
                  Acessar administração
                </Button>
              ) : null}

              <SignOutForm />
            </div>
          </div>
        </aside>

        <div className="safe-scroll-pb min-w-0 md:pb-0">
          <header className="safe-pt sticky top-0 z-30 border-b border-white/[0.06] bg-background/82 px-4 pb-3 backdrop-blur-2xl md:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link
                aria-label="Abrir perfil e configurações"
                className="flex min-w-0 items-center gap-2.5 focus-visible:outline-action-soft"
                href="/app/perfil/editar"
              >
                <MemberAvatar avatarUrl={context.profile.avatar_url} name={displayName} />
                <span className="min-w-0">
                  <span className="block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-action-soft">
                    {cycleLabel}
                  </span>
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </span>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <NotificationBellLink compact unreadCount={unreadNotificationCount} />
                {showAdminAccess ? (
                  <Button
                    aria-label="Acessar administração"
                    as="a"
                    href="/admin"
                    size="sm"
                    variant="secondary"
                  >
                    <ShieldCheck aria-hidden="true" size={15} />
                  </Button>
                ) : null}
                <SignOutForm compact />
              </div>
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
