"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const anchorLinks = [
  { label: "Experiência", href: "#produto" },
  { label: "Evolução", href: "#evolucao" },
  { label: "Reflexão", href: "#reflexao" },
];

export function PublicMobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        aria-controls="public-mobile-nav"
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        className="flex size-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-foreground transition-colors duration-[var(--motion-base)] hover:bg-white/[0.08] focus-visible:outline-action-soft"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
      </button>

      {open ? (
        <nav
          aria-label="Navegação pública"
          className="absolute inset-x-4 top-full mt-2 rounded-2xl border border-white/[0.08] bg-background/97 p-2 shadow-[var(--shadow-lift)] backdrop-blur-xl"
          id="public-mobile-nav"
        >
          <ul className="flex flex-col">
            {anchorLinks.map((item) => (
              <li key={item.href}>
                <Link
                  className="block rounded-xl px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft"
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="my-1 h-px bg-white/[0.08]" />
            <li>
              <Link
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft"
                href="/login"
                onClick={() => setOpen(false)}
              >
                Entrar
              </Link>
            </li>
            <li>
              <Link
                className="block rounded-xl px-4 py-3 text-sm font-semibold text-action-soft transition-colors hover:bg-white/[0.06] focus-visible:outline-action-soft"
                href="/cadastro"
                onClick={() => setOpen(false)}
              >
                Começar meu Dia 1
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
