"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Lightbulb, Settings, Trophy, UserCog } from "lucide-react";

import { cn } from "@/lib/utils";

// Participant management lives entirely inside each challenge now (Admin ->
// Desafios -> selecionar desafio -> Ver participantes) - metrics like
// progress/points/streak only make sense in that context, so there's no
// standalone "Participantes" destination anymore. See
// admin/desafios/[challengeId]/participantes for the real flow.
const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Visão geral" },
  { href: "/admin/desafios", icon: Trophy, label: "Desafios" },
  { href: "/admin/dicas", icon: Lightbulb, label: "Dicas" },
  { href: "/admin/usuarios", icon: UserCog, label: "Usuários" },
  { href: "/admin/configuracoes", icon: Settings, label: "Configurações" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  icon: Icon,
  label,
  mode,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  mode: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

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

export function AdminDesktopNavigation() {
  return (
    <nav aria-label="Navegação administrativa" className="space-y-1">
      {navItems.map((item) => (
        <NavLink {...item} key={item.href} mode="desktop" />
      ))}
    </nav>
  );
}

export function AdminMobileNavigation() {
  return (
    <nav
      aria-label="Navegação administrativa"
      className="safe-fixed-bottom fixed inset-x-3 z-40 rounded-[1.55rem] border border-white/[0.10] bg-background/84 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.44)] backdrop-blur-2xl md:hidden"
    >
      <div className="flex gap-1">
        {navItems.map((item) => (
          <NavLink {...item} key={item.href} mode="mobile" />
        ))}
      </div>
    </nav>
  );
}
