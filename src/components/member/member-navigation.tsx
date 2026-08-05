"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { isMaisActive, isMemberRouteActive, PRIMARY_MOBILE_ITEMS } from "@/features/member/member-navigation.core";

/**
 * Barra inferior mobile/PWA - exatamente 5 áreas de toque (4 itens de uso
 * diário + Mais), arquitetura DIFERENTE e complementar à sidebar desktop
 * completa (member-sidebar.tsx), mas lendo os mesmos itens centrais
 * (member-navigation.core.ts) - nunca um segundo array divergente.
 */
function MobileNavLink({
  active,
  badgeCount,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  badgeCount?: number;
  href: string;
  icon: typeof MoreHorizontal;
  label: string;
}) {
  const hasBadge = Boolean(badgeCount && badgeCount > 0);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      aria-label={hasBadge ? `${label}, ${badgeCount} novidade${badgeCount === 1 ? "" : "s"}` : undefined}
      className={cn(
        "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[1.15rem] text-[0.66rem] font-semibold transition-[background,color,transform] duration-[var(--motion-base)] focus-visible:outline-action-soft active:scale-[0.98]",
        active
          ? "bg-white/[0.08] text-foreground"
          : "text-muted hover:bg-white/[0.045] hover:text-foreground",
      )}
      href={href}
    >
      <span className="relative">
        <Icon aria-hidden="true" className={active ? "text-action-soft" : undefined} size={18} />
        {hasBadge ? (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex min-w-[1.05rem] items-center justify-center rounded-full border border-background bg-action px-1 font-mono text-[0.58rem] font-semibold leading-[1.05rem] text-white"
          >
            {badgeCount! > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate px-0.5">{label}</span>
      {active ? <span aria-hidden="true" className="absolute top-1.5 size-1 rounded-full bg-action-soft" /> : null}
    </Link>
  );
}

export function MemberMobileNavigation({ maisBadgeCount = 0 }: { maisBadgeCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegacao principal"
      className="safe-fixed-bottom fixed inset-x-3 z-40 rounded-[1.55rem] border border-white/[0.10] bg-background/84 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.44)] backdrop-blur-2xl md:hidden"
    >
      <div className="flex gap-1">
        {PRIMARY_MOBILE_ITEMS.map((item) => (
          <MobileNavLink
            active={isMemberRouteActive(pathname, item.href!)}
            href={item.href!}
            icon={item.icon}
            key={item.href}
            label={item.label}
          />
        ))}
        <MobileNavLink
          active={isMaisActive(pathname)}
          badgeCount={maisBadgeCount}
          href="/app/mais"
          icon={MoreHorizontal}
          label="Mais"
        />
      </div>
    </nav>
  );
}
