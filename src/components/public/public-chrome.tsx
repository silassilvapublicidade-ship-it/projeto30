import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const primaryNav = [
  { label: "Manifesto", href: "/manifesto" },
  { label: "Sobre", href: "/sobre" },
  { label: "Como funciona", href: "/como-funciona" },
  { label: "FAQ", href: "/faq" },
];

const footerLinks = [
  { label: "Entrar", href: "/login" },
  { label: "Cadastro", href: "/cadastro" },
  { label: "Manifesto", href: "/manifesto" },
  { label: "Termos", href: "/termos" },
  { label: "Privacidade", href: "/privacidade" },
];

export function BrandMark({
  className,
  preload = false,
}: {
  className?: string;
  preload?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandLogo decorative preload={preload} size={40} />
      <span className="leading-none">
        <span className="block text-sm font-semibold text-foreground">Projeto 30</span>
        <span className="mt-1 block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-2">
          Disciplina calma
        </span>
      </span>
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-3 z-40 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[var(--radius-pill)] border border-white/[0.08] bg-background/82 px-3 py-2 shadow-[var(--shadow-hairline)] backdrop-blur-xl">
        <Link
          aria-label="Projeto 30, ir para a página inicial"
          className="min-w-0 rounded-[var(--radius-pill)] focus-visible:outline-action-soft"
          href="/"
        >
          <BrandMark className="min-w-0" preload />
        </Link>

        <nav
          aria-label="Navegação pública"
          className="hidden items-center gap-1 rounded-[var(--radius-pill)] border border-white/[0.07] bg-white/[0.045] p-1 md:flex"
        >
          {primaryNav.map((item) => (
            <Link
              className="rounded-[var(--radius-pill)] px-3 py-2 text-xs font-semibold text-muted transition-colors duration-[var(--motion-base)] hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button as="a" href="/login" size="sm" variant="ghost">
            Entrar
          </Button>
          <Button
            as="a"
            className="hidden sm:inline-flex"
            href="/cadastro"
            size="sm"
            trailingIcon={<ArrowRight aria-hidden="true" size={14} />}
          >
            Começar
          </Button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl border-t border-white/[0.08] pt-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              Pequenas escolhas. Grandes transformações.
            </p>
          </div>

          <nav
            aria-label="Links do rodapé"
            className="flex flex-wrap gap-x-6 gap-y-2.5 text-sm font-medium text-muted sm:justify-end"
          >
            {footerLinks.map((link) => (
              <Link
                className="transition-colors hover:text-foreground focus-visible:outline-action-soft"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-8 font-mono text-xs text-muted-2">© {year} Projeto 30.</p>
      </div>
    </footer>
  );
}
