"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flag,
  Home,
  Lightbulb,
  Medal,
  NotebookPen,
  Route,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Perfil intentionally left out of the main navigation - it stays reachable
// through the avatar/user block instead (member-shell.tsx), which already
// linked to /app/perfil, so removing it here just drops the duplicate entry
// point rather than losing access to the route.
const mainItems = [
  { href: "/app/hoje", icon: Home, label: "Hoje" },
  { href: "/app/desafios", icon: Flag, label: "Desafios" },
  { href: "/app/jornada", icon: Route, label: "Jornada" },
  { href: "/app/dicas", icon: Lightbulb, label: "Dicas" },
  { href: "/app/conquistas", icon: Medal, label: "Conquistas", mobileLabel: "Marcos" },
];

const secondaryItems = [
  { href: "/app/diario", icon: NotebookPen, label: "Diario" },
  { href: "/app/configuracoes", icon: Settings, label: "Configuracoes" },
];

function NavLink({
  href,
  icon: Icon,
  label,
  mobileLabel,
  mode,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  mobileLabel?: string;
  mode: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

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
        <span>{mobileLabel ?? label}</span>
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
  return (
    <nav aria-label="Navegacao da area de membros" className="space-y-6">
      <div className="space-y-1">
        {mainItems.map((item) => (
          <NavLink {...item} key={item.href} mode="desktop" />
        ))}
      </div>
      <div className="border-t border-white/[0.08] pt-4">
        <p className="px-3 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">
          Mais
        </p>
        <div className="mt-2 space-y-1">
          {secondaryItems.map((item) => (
            <NavLink {...item} key={item.href} mode="desktop" />
          ))}
        </div>
      </div>
    </nav>
  );
}

export function MemberMobileNavigation() {
  return (
    <nav
      aria-label="Navegacao principal"
      className="safe-fixed-bottom fixed inset-x-3 z-40 rounded-[1.55rem] border border-white/[0.10] bg-background/84 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.44)] backdrop-blur-2xl md:hidden"
    >
      <div className="flex gap-1">
        {mainItems.map((item) => (
          <NavLink {...item} key={item.href} mode="mobile" />
        ))}
      </div>
    </nav>
  );
}
