import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export type MaisItem = {
  description?: string;
  href: string;
  icon: LucideIcon;
  label: string;
};

/**
 * Um bloco de destinos relacionados dentro do hub /app/mais (Parte E):
 * card único, espaçamento generoso, ícone consistente, descrição só nos
 * itens que precisam de contexto extra, seta discreta, feedback de
 * hover/touch. É a unidade que faz a navegação escalar - uma categoria
 * nova no futuro é só mais um MaisGroupCard, nunca um item solto.
 */
export function MaisGroupCard({ items, title }: { items: MaisItem[]; title: string }) {
  return (
    <Card className="p-2 hover:translate-y-0 sm:p-2.5">
      <h2 className="px-3 pt-2.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">{title}</h2>
      <div className="mt-1.5 space-y-0.5">
        {items.map((item) => (
          <Link
            className="flex min-w-0 items-center gap-3 rounded-[1.1rem] p-3 transition-colors duration-[var(--motion-base)] ease-[var(--ease-premium)] hover:bg-white/[0.05] active:scale-[0.99] focus-visible:outline-action-soft"
            href={item.href}
            key={item.href}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action/12 text-action-soft">
              <item.icon aria-hidden="true" size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{item.label}</span>
              {item.description ? <span className="block text-xs text-muted-2">{item.description}</span> : null}
            </span>
            <ChevronRight aria-hidden="true" className="shrink-0 text-muted-2" size={16} />
          </Link>
        ))}
      </div>
    </Card>
  );
}
