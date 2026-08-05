"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  ImageIcon,
  LayoutDashboard,
  Lightbulb,
  MessageCircle,
  MoreHorizontal,
  Trophy,
  UserCog,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Participant management lives entirely inside each challenge now (Admin ->
// Desafios -> selecionar desafio -> Ver participantes) - metrics like
// progress/points/streak only make sense in that context, so there's no
// standalone "Participantes" destination anymore. See
// admin/desafios/[challengeId]/participantes for the real flow.
//
// mobileLabel: opcional, só usado pela barra inferior (já apertada com 8
// itens). "Observabilidade" é o único item que define um rótulo mais curto
// ("Diagnóstico" - o próprio nome alternativo sugerido para a área) para
// não comprimir ainda mais os outros rótulos no mobile; todo o resto
// continua usando `label` em ambos os modos, sem mudança de comportamento.
// overflow: true agrupa o item sob a aba "Mais" SÓ no mobile (a barra fixa
// já estava no limite com 9 itens - adicionar Feedback como 10º item flat
// apertaria demais). Desktop ignora a flag e mostra tudo direto na sidebar,
// sem essa restrição de espaço.
const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Visão geral" },
  { href: "/admin/desafios", icon: Trophy, label: "Desafios" },
  { href: "/admin/usuarios", icon: UserCog, label: "Usuários" },
  { href: "/admin/dicas", icon: Lightbulb, label: "Dicas" },
  { href: "/admin/biblioteca", icon: BookOpen, label: "Biblioteca", overflow: true },
  { href: "/admin/notificacoes", icon: Bell, label: "Notificações" },
  { href: "/admin/compartilhamentos", icon: ImageIcon, label: "Compartilhamentos" },
  { href: "/admin/observabilidade", icon: Activity, label: "Observabilidade", mobileLabel: "Diagnóstico" },
  { href: "/admin/feedback", icon: MessageCircle, label: "Feedback" },
  { href: "/admin/conquistas", icon: Award, label: "Conquistas", overflow: true },
];

const mobilePrimaryItems = navItems.filter((item) => !item.overflow);
const mobileOverflowItems = navItems.filter((item) => item.overflow);

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
  mobileLabel,
  mode,
}: {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  mobileLabel?: string;
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

export function AdminDesktopNavigation() {
  return (
    <nav aria-label="Navegação administrativa" className="space-y-1">
      {navItems.map((item) => (
        <NavLink {...item} key={item.href} mode="desktop" />
      ))}
    </nav>
  );
}

function AdminMobileMoreTab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = mobileOverflowItems.some((item) => isActivePath(pathname, item.href));

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative flex flex-1" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[1.15rem] text-[0.66rem] font-semibold transition-[background,color,transform] duration-[var(--motion-base)] focus-visible:outline-action-soft active:scale-[0.98]",
          active || open
            ? "bg-white/[0.08] text-foreground"
            : "text-muted hover:bg-white/[0.045] hover:text-foreground",
        )}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" className={active ? "text-action-soft" : undefined} size={18} />
        <span>Mais</span>
      </button>

      {open ? (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 rounded-[1.1rem] border border-white/[0.10] bg-matte/98 p-1.5 shadow-[var(--shadow-lift)]"
          role="menu"
        >
          {mobileOverflowItems.map((item) => (
            <Link
              className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-white/[0.07]"
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <item.icon aria-hidden="true" size={17} />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminMobileNavigation() {
  return (
    <nav
      aria-label="Navegação administrativa"
      className="safe-fixed-bottom fixed inset-x-3 z-40 rounded-[1.55rem] border border-white/[0.10] bg-background/84 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.44)] backdrop-blur-2xl md:hidden"
    >
      <div className="flex gap-1">
        {mobilePrimaryItems.map((item) => (
          <NavLink {...item} key={item.href} mode="mobile" />
        ))}
        <AdminMobileMoreTab />
      </div>
    </nav>
  );
}
