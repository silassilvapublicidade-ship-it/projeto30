"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  DESKTOP_SIDEBAR_GROUPS,
  filterNavGroupsByRole,
  isMemberRouteActive,
  type MemberNavItem,
} from "@/features/member/member-navigation.core";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { SignOutForm } from "@/components/member/sign-out-form";

function SidebarLink({ active, item }: { active: boolean; item: MemberNavItem }) {
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-[1.1rem] px-3 text-sm font-semibold transition-[background,color,border-color,transform] duration-[var(--motion-base)] focus-visible:outline-action-soft active:scale-[0.99]",
        active
          ? "bg-white/[0.07] text-foreground shadow-[var(--shadow-hairline)]"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground",
      )}
      href={item.href!}
    >
      {active ? <span aria-hidden="true" className="absolute left-0 h-5 w-0.5 rounded-full bg-action-soft" /> : null}
      <Icon aria-hidden="true" className={active ? "text-action-soft" : undefined} size={17} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/**
 * Sidebar desktop COMPLETA (Parte B/L) - arquitetura deliberadamente
 * diferente da barra mobile: aproveita o espaço disponível para dar
 * acesso direto a tudo (Dicas, Conquistas, Diário, Feedback,
 * Configurações, Notificações, Editar perfil, Admin, Sair), sem exigir
 * passar pelo hub /app/mais para uso frequente. Lê os mesmos itens
 * centrais de member-navigation.core.ts que a barra mobile e o hub Mais
 * usam - nunca uma segunda fonte divergente de rótulos/rotas.
 */
export function MemberDesktopSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const groups = filterNavGroupsByRole(DESKTOP_SIDEBAR_GROUPS, isAdmin);

  return (
    <nav
      aria-label="Navegacao da area de membros"
      className="max-h-full space-y-5 overflow-y-auto pr-1"
    >
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">{group.title}</p>
          <div className="mt-2 space-y-1">
            {group.items.map((item) => {
              if (item.special === "install-app") {
                return (
                  <div className="rounded-[1.1rem] px-3 py-2" key="install-app">
                    <InstallAppPrompt />
                  </div>
                );
              }
              if (item.special === "sign-out") {
                return (
                  <div className="px-1 pt-1" key="sign-out">
                    <SignOutForm />
                  </div>
                );
              }
              return <SidebarLink active={isMemberRouteActive(pathname, item.href!)} item={item} key={item.href} />;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
