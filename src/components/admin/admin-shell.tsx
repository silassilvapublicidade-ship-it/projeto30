import type { ReactNode } from "react";
import { ArrowLeft, LogOut } from "lucide-react";

import {
  AdminDesktopNavigation,
  AdminMobileNavigation,
} from "@/components/admin/admin-navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { signOutAndRedirectAction } from "@/features/auth/auth.actions";
import type { AdminUser } from "@/server/services/admin-session.service";

const roleLabels: Record<AdminUser["role"], string> = {
  admin: "Administrador",
  moderator: "Moderador",
  super_admin: "Super admin",
  user: "Usuário",
};

export function AdminShell({
  admin,
  children,
}: {
  admin: AdminUser;
  children: ReactNode;
}) {
  const roleLabel = roleLabels[admin.role];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]" />
      <div className="safe-x mx-auto grid min-h-dvh w-full max-w-[1360px] md:grid-cols-[16.5rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh px-4 py-5 md:block">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-3 shadow-[var(--shadow-hairline)]">
              <BrandLogo decorative preload size={40} />
              <span>
                <span className="block text-sm font-semibold">Projeto 30</span>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">
                  Painel administrativo
                </span>
              </span>
            </div>

            <div className="mt-6">
              <AdminDesktopNavigation />
            </div>

            <div className="mt-auto space-y-3">
              <div className="rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-4">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">
                  {roleLabel}
                </p>
                <p className="mt-2 truncate text-sm font-semibold text-foreground">
                  {admin.email}
                </p>
              </div>

              <Button
                as="a"
                className="w-full"
                href="/app/hoje"
                leadingIcon={<ArrowLeft aria-hidden="true" size={15} />}
                variant="secondary"
              >
                Voltar para o aplicativo
              </Button>

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

        <div className="safe-scroll-pb min-w-0 md:pb-0">
          <header className="safe-pt sticky top-0 z-30 border-b border-white/[0.06] bg-background/82 px-4 pb-3 backdrop-blur-2xl md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-action-soft">
                  {roleLabel}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {admin.email}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  aria-label="Voltar para o aplicativo"
                  as="a"
                  href="/app/hoje"
                  size="sm"
                  variant="secondary"
                >
                  <ArrowLeft aria-hidden="true" size={15} />
                </Button>
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
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-10 lg:px-12">
            {children}
          </main>
        </div>
      </div>
      <AdminMobileNavigation />
    </div>
  );
}
