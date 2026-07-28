import type { ReactNode } from "react";
import Link from "next/link";

import { RhythmRail } from "@/components/brand/rhythm-rail";
import { Card } from "@/components/ui/card";

export function AuthShell({
  children,
  eyebrow,
  footer,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  footer: ReactNode;
  title: string;
}) {
  return (
    <main className="overflow-x-hidden px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="w-full min-w-0 max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-action-soft">
            {eyebrow}
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[1.02] text-foreground sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 text-base leading-8 text-muted">
            Entre com calma. O acesso existe para guardar a jornada, não para criar
            pressa.
          </p>
          <div className="mt-8 w-full max-w-md min-w-0">
            <RhythmRail compact />
          </div>
        </div>

        <Card tone="glass" className="min-w-0 p-5 sm:p-7">
          {children}
          <div className="mt-6 border-t border-white/[0.08] pt-5 text-sm leading-6 text-muted">
            {footer}
          </div>
        </Card>
      </div>
    </main>
  );
}

export function AuthLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="font-semibold text-action-soft transition-colors hover:text-action focus-visible:outline-action-soft"
      href={href}
    >
      {children}
    </Link>
  );
}
