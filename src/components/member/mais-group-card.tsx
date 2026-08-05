import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { SignOutForm } from "@/components/member/sign-out-form";
import type { MemberNavGroup } from "@/features/member/member-navigation.core";

/**
 * Um bloco de destinos relacionados dentro do hub /app/mais (Parte E,
 * refinada para parecer uma área premium do Projeto 30, não uma segunda
 * tela de Configurações): selo de ícone do grupo bem visível, espaço
 * generoso, itens com ícone próprio + descrição só onde ajuda, seta
 * discreta, feedback de hover/touch. Lê diretamente os itens centrais de
 * member-navigation.core.ts - a mesma fonte usada pela sidebar desktop -
 * então uma categoria nova no futuro é só mais um grupo lá, nunca um
 * componente novo aqui.
 */
export function MaisGroupCard({ group }: { group: MemberNavGroup }) {
  const GroupIcon = group.icon;
  const isSoleSignOut = group.items.length === 1 && group.items[0]?.special === "sign-out";

  return (
    <Card className="p-5 hover:translate-y-0 sm:p-6">
      {!isSoleSignOut ? (
        <div className="flex items-center gap-3">
          {GroupIcon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-action/12 text-action-soft">
              <GroupIcon aria-hidden="true" size={18} />
            </span>
          ) : null}
          <h2 className="text-base font-semibold text-foreground">{group.title}</h2>
        </div>
      ) : null}

      <div className={isSoleSignOut ? "" : "mt-4 space-y-1"}>
        {group.items.map((item) => {
          if (item.special === "install-app") {
            return (
              <div className="rounded-[1.1rem] bg-white/[0.03] p-3.5" key="install-app">
                <p className="mb-2 text-sm font-semibold text-foreground">{item.label}</p>
                <InstallAppPrompt />
              </div>
            );
          }

          if (item.special === "sign-out") {
            return <SignOutForm key="sign-out" />;
          }

          const Icon = item.icon;

          return (
            <Link
              className="flex min-w-0 items-center gap-3.5 rounded-[1.1rem] p-3.5 transition-colors duration-[var(--motion-base)] ease-[var(--ease-premium)] hover:bg-white/[0.05] active:scale-[0.99] focus-visible:outline-action-soft"
              href={item.href!}
              key={item.href}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-foreground">
                <Icon aria-hidden="true" size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                {item.description ? <span className="mt-0.5 block text-xs leading-5 text-muted-2">{item.description}</span> : null}
              </span>
              <ChevronRight aria-hidden="true" className="shrink-0 text-muted-2" size={16} />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
