"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Home, LayoutDashboard, MoreHorizontal, Route } from "lucide-react";

import { cn } from "@/lib/utils";

// Arquitetura de navegação definitiva (rodada de reorganização): a barra
// principal (mobile e desktop, agora unificadas) mostra só os 4 destinos de
// USO DIÁRIO - tudo o que é "conta/configuração/uma vez por semana" (
// Conquistas, Diário, Dicas, Configurações, Notificações, Feedback, editar
// perfil, admin) vive dentro de /app/mais, um hub próprio, nunca mais
// espalhado em itens soltos que crescem sem limite conforme o produto
// cresce. Isso é o que torna a barra escalável: novas telas entram em
// /app/mais, nunca aqui.
const mainItems = [
  { href: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/app/hoje", icon: Home, label: "Hoje" },
  { href: "/app/jornada", icon: Route, label: "Jornada" },
  { href: "/app/desafios", icon: Flag, label: "Desafios" },
];

// Toda página que agora só é alcançável a partir do hub /app/mais - usado
// para acender o item "Mais" quando o usuário está em qualquer uma delas,
// em vez de a barra parecer "sem seleção" nessas telas.
const MAIS_ACTIVE_PREFIXES = [
  "/app/mais",
  "/app/conquistas",
  "/app/diario",
  "/app/dicas",
  "/app/configuracoes",
  "/app/feedback",
  "/app/perfil",
  "/app/notificacoes",
];

function isMaisActive(pathname: string) {
  return MAIS_ACTIVE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPrimaryActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  active,
  href,
  icon: Icon,
  label,
  mode,
}: {
  active: boolean;
  href: string;
  icon: typeof Home;
  label: string;
  mode: "desktop" | "mobile";
}) {
  if (mode === "mobile") {
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[1.15rem] text-[0.66rem] font-semibold transition-[background,color,transform] duration-[var(--motion-base)] focus-visible:outline-action-soft active:scale-[0.98]",
          active
            ? "bg-white/[0.08] text-foreground"
            : "text-muted hover:bg-white/[0.045] hover:text-foreground",
        )}
        href={href}
      >
        <Icon
          aria-hidden="true"
          className={active ? "text-action-soft" : undefined}
          size={18}
        />
        <span>{label}</span>
        {active ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 size-1 rounded-full bg-action-soft"
          />
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-[1.1rem] px-3 text-sm font-semibold transition-[background,color,border-color,transform] duration-[var(--motion-base)] focus-visible:outline-action-soft active:scale-[0.99]",
        active
          ? "bg-white/[0.07] text-foreground shadow-[var(--shadow-hairline)]"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground",
      )}
      href={href}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute left-0 h-5 w-0.5 rounded-full bg-action-soft"
        />
      ) : null}
      <Icon
        aria-hidden="true"
        className={active ? "text-action-soft" : undefined}
        size={17}
      />
      <span>{label}</span>
    </Link>
  );
}

export function MemberDesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegacao da area de membros" className="space-y-1">
      {mainItems.map((item) => (
        <NavLink {...item} active={isPrimaryActive(pathname, item.href)} key={item.href} mode="desktop" />
      ))}
      <NavLink active={isMaisActive(pathname)} href="/app/mais" icon={MoreHorizontal} label="Mais" mode="desktop" />
    </nav>
  );
}

export function MemberMobileNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegacao principal"
      className="safe-fixed-bottom fixed inset-x-3 z-40 rounded-[1.55rem] border border-white/[0.10] bg-background/84 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.44)] backdrop-blur-2xl md:hidden"
    >
      <div className="flex gap-1">
        {mainItems.map((item) => (
          <NavLink {...item} active={isPrimaryActive(pathname, item.href)} key={item.href} mode="mobile" />
        ))}
        <NavLink active={isMaisActive(pathname)} href="/app/mais" icon={MoreHorizontal} label="Mais" mode="mobile" />
      </div>
    </nav>
  );
}
