import Link from "next/link";

import { BrandMark } from "@/components/public/public-chrome";
import { PublicMobileMenu } from "@/components/public/public-mobile-menu";
import { Button } from "@/components/ui/button";

const anchorLinks = [
  { label: "Experiência", href: "#produto" },
  { label: "Evolução", href: "#evolucao" },
  { label: "Reflexão", href: "#reflexao" },
];

export function PublicHeader() {
  return (
    <header className="safe-pt relative px-4 pb-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link
          aria-label="Projeto 30, ir para a página inicial"
          className="min-w-0 focus-visible:outline-action-soft"
          href="/"
        >
          <BrandMark className="min-w-0" preload />
        </Link>

        <nav
          aria-label="Navegação pública"
          className="hidden items-center gap-1 md:flex"
        >
          {anchorLinks.map((item) => (
            <a
              className="rounded-[var(--radius-pill)] px-3 py-2 text-xs font-semibold text-muted transition-colors duration-[var(--motion-base)] hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button as="a" className="hidden sm:inline-flex" href="/login" size="sm" variant="ghost">
            Entrar
          </Button>
          <Button as="a" href="/cadastro" size="sm">
            Começar meu Dia 1
          </Button>
          <PublicMobileMenu />
        </div>
      </div>
    </header>
  );
}
