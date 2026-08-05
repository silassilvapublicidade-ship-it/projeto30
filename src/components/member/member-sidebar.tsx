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

function SidebarLink({ active, emphasized, item }: { active: boolean; emphasized?: boolean; item: MemberNavItem }) {
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-[1.1rem] px-3 text-sm font-semibold transition-[background,color,border-color,transform] duration-[var(--motion-base)] ease-[var(--ease-premium)] focus-visible:outline-action-soft active:scale-[0.99]",
        emphasized ? "min-h-12" : "min-h-11",
        active
          ? "bg-white/[0.07] text-foreground shadow-[var(--shadow-hairline)]"
          : emphasized
            ? "bg-white/[0.035] text-foreground hover:bg-white/[0.06]"
            : "text-muted hover:bg-white/[0.04] hover:text-foreground",
      )}
      href={item.href!}
    >
      {active ? <span aria-hidden="true" className="absolute left-0 h-5 w-0.5 rounded-full bg-action-soft" /> : null}
      <Icon aria-hidden="true" className={active ? "text-action-soft" : undefined} size={emphasized ? 18 : 17} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/**
 * Sidebar desktop COMPLETA (Parte B/L) - arquitetura deliberadamente
 * diferente da barra mobile: aproveita o espaço disponível para dar
 * acesso direto a tudo, sem exigir passar pelo hub /app/mais para uso
 * frequente ("Mais" nem aparece aqui - no desktop deixa de fazer
 * sentido). Dashboard e Hoje - os dois destinos abertos todos os dias -
 * ganham um destaque visual sutil (fundo próprio, separados do resto de
 * Principal por um espaço), reforçando que são o par mais usado.
 */
export function MemberDesktopSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const groups = filterNavGroupsByRole(DESKTOP_SIDEBAR_GROUPS, isAdmin);

  return (
    <nav aria-label="Navegacao da area de membros" className="max-h-full space-y-5 overflow-y-auto pr-1">
      {groups.map((group) => {
        const isPrincipal = group.title === "Principal";
        const dailyItems = isPrincipal ? group.items.slice(0, 2) : [];
        const restItems = isPrincipal ? group.items.slice(2) : group.items;

        return (
          <div key={group.title}>
            <p className="px-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">{group.title}</p>

            {dailyItems.length > 0 ? (
              <div className="mt-2 space-y-1 rounded-[1.2rem] border border-white/[0.06] bg-white/[0.02] p-1.5">
                {dailyItems.map((item) => (
                  <SidebarLink active={isMemberRouteActive(pathname, item.href!)} emphasized item={item} key={item.href} />
                ))}
              </div>
            ) : null}

            <div className={cn("space-y-1", dailyItems.length > 0 ? "mt-2" : "mt-2")}>
              {restItems.map((item) => {
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
        );
      })}
    </nav>
  );
}
