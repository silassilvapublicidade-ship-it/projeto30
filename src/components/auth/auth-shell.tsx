import type { ReactNode } from "react";
import Link from "next/link";

import { AuthBackdrop } from "@/components/auth/auth-backdrop";
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel";
import { BrandLogo } from "@/components/brand/brand-logo";

const MOBILE_HEADLINE = "Continue o que você começou.";

export function AuthShell({
  cardDescription,
  cardTitle,
  children,
  footer,
}: {
  cardDescription: string;
  cardTitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <AuthBackdrop />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-[max(2rem,env(safe-area-inset-top))] sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8">
        <div className="hidden lg:flex lg:items-center">
          <AuthVisualPanel />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center lg:items-stretch">
          <div className="mb-8 text-center lg:hidden">
            <BrandLogo className="mx-auto" label="Projeto 30" preload size={40} />
            <p className="font-display mt-5 text-2xl leading-[1.15] text-foreground">
              {MOBILE_HEADLINE}
            </p>
          </div>

          <div className="w-full max-w-md min-w-0 rounded-[var(--radius-panel)] border border-white/[0.10] bg-white/[0.05] p-6 shadow-[var(--shadow-lift)] backdrop-blur-xl [animation:p30-fade-up_var(--motion-base)_var(--ease-premium)] sm:p-8">
            <BrandLogo className="hidden lg:block" label="Projeto 30" preload size={36} />
            <h2 className="font-display mt-5 text-2xl leading-[1.15] text-foreground lg:mt-6">
              {cardTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{cardDescription}</p>

            <div className="mt-7">{children}</div>

            <div className="mt-6 border-t border-white/[0.08] pt-5 text-sm leading-6 text-muted">
              {footer}
            </div>
          </div>
        </div>
      </div>

      <p className="relative z-10 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-2">
        <Link className="hover:text-muted focus-visible:outline-action-soft" href="/">
          Projeto 30
        </Link>
      </p>
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
