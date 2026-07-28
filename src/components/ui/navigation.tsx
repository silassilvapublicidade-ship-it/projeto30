import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  icon?: ReactNode;
};

type NavigationProps = ComponentPropsWithoutRef<"nav"> & {
  items: NavItem[];
};

export function Navigation({ className, items, ...props }: NavigationProps) {
  return (
    <nav
      aria-label="Navegacao principal"
      className={cn(
        "flex items-center gap-1 rounded-[var(--radius-pill)] border border-white/[0.08] bg-white/[0.055] p-1 shadow-[var(--shadow-hairline)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <a
          key={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center justify-center gap-2 rounded-[var(--radius-pill)] px-3 text-xs font-semibold text-muted transition-[background,color] duration-[var(--motion-base)] ease-[var(--ease-premium)] hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft",
            item.active &&
              "bg-foreground text-background hover:bg-foreground hover:text-background",
          )}
          href={item.href}
        >
          {item.icon}
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
