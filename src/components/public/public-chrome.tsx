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

const footerGroups = [
  {
    title: "Projeto",
    links: [
      { label: "Manifesto", href: "/manifesto" },
      { label: "Sobre", href: "/sobre" },
      { label: "Como funciona", href: "/como-funciona" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Acesso",
    links: [
      { label: "Entrar", href: "/login" },
      { label: "Criar conta", href: "/cadastro" },
      { label: "Recuperar senha", href: "/recuperar-senha" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidade", href: "/privacidade" },
      { label: "Termos", href: "/termos" },
    ],
  },
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
  return (
    <footer className="px-4 pb-8 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-6 shadow-[var(--shadow-hairline)] sm:p-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <BrandMark />
            <p className="mt-5 max-w-md text-sm leading-7 text-muted">
              O Projeto 30 é uma experiência digital para transformar intenção em
              constância, um dia de cada vez.
            </p>
            <p className="mt-5 font-mono text-xs text-muted-2">
              Idealizado por Silas Silva. Conteúdo e direção em evolução.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-2">
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        className="text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-action-soft"
                        href={link.href}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.08] pt-5 text-xs text-muted-2 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Projeto 30.</span>
          <span>Produto em construção responsável. Sem promessas milagrosas.</span>
        </div>
      </div>
    </footer>
  );
}
