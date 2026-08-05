import Link from "next/link";
import type { Metadata } from "next";
import {
  Bell,
  HelpCircle,
  Lightbulb,
  Medal,
  MessageCircle,
  MessagesSquare,
  NotebookPen,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { MaisGroupCard, type MaisItem } from "@/components/member/mais-group-card";
import { MaisHeader } from "@/components/member/mais-header";
import { ShareAppButton } from "@/components/member/share-app-button";
import { SignOutForm } from "@/components/member/sign-out-form";
import { Card } from "@/components/ui/card";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { isAdminRole } from "@/features/admin/admin-access.core";
import { getMemberContext } from "@/server/services/member-area.service";

export const metadata: Metadata = {
  title: "Mais",
};

const contaItems: MaisItem[] = [
  { href: "/app/perfil/editar", icon: UserRound, label: "Editar perfil" },
  { href: "/app/configuracoes", icon: Settings, label: "Configurações" },
  { href: "/app/notificacoes", icon: Bell, label: "Notificações" },
  {
    description: "Encontrou um problema ou tem uma ideia?",
    href: "/app/feedback",
    icon: MessageCircle,
    label: "Enviar feedback",
  },
  { href: "/app/feedback/meus", icon: MessagesSquare, label: "Meus feedbacks" },
];

const evolucaoItems: MaisItem[] = [
  { description: "Veja todos os marcos desbloqueados.", href: "/app/conquistas", icon: Medal, label: "Conquistas" },
  { description: "Relembre sua caminhada.", href: "/app/diario", icon: NotebookPen, label: "Diário" },
  { href: "/app/dicas", icon: Lightbulb, label: "Dicas" },
];

/**
 * Hub definitivo de navegação secundária (rodada de reorganização, Parte
 * C/D). Tudo que não é uso diário vive aqui, agrupado por categoria - uma
 * categoria nova no futuro é só um MaisGroupCard a mais, nunca um item
 * solto disputando espaço na barra principal. Reaproveita getMemberContext()
 * já usado por toda a área de membros - nenhuma consulta nova (Parte P).
 */
export default async function MaisPage() {
  const context = await getMemberContext();
  const isAdmin = isAdminRole(context.profile.role);

  return (
    <div className="space-y-6">
      <MaisHeader context={context} />

      <div className="grid gap-4 sm:grid-cols-2">
        <MaisGroupCard items={contaItems} title="Conta" />
        <MaisGroupCard items={evolucaoItems} title="Minha evolução" />

        <Card className="space-y-4 p-4 hover:translate-y-0 sm:p-5">
          <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Aplicativo</h2>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Instalar aplicativo</p>
            <InstallAppPrompt />
          </div>

          <div className="border-t border-white/[0.08] pt-4">
            <ShareAppButton />
          </div>

          <div className="border-t border-white/[0.08] pt-4">
            <Link
              className="flex min-w-0 items-center gap-3 rounded-[1.1rem] p-2 transition-colors hover:bg-white/[0.05] focus-visible:outline-action-soft"
              href="/faq"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action/12 text-action-soft">
                <HelpCircle aria-hidden="true" size={16} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">Ajuda</span>
            </Link>
          </div>
        </Card>

        <Card className="space-y-1 p-4 hover:translate-y-0 sm:p-5">
          <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Sistema</h2>

          {isAdmin ? (
            <Link
              className="flex min-w-0 items-center gap-3 rounded-[1.1rem] p-2 transition-colors hover:bg-white/[0.05] focus-visible:outline-action-soft"
              href="/admin"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action/12 text-action-soft">
                <ShieldCheck aria-hidden="true" size={16} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">Área administrativa</span>
            </Link>
          ) : null}

          <div className="pt-2">
            <SignOutForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
