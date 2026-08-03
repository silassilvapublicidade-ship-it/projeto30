import Link from "next/link";
import { Bell, ChevronRight, Settings } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Card } from "@/components/ui/card";
import { getMemberContext } from "@/server/services/member-area.service";

function getNotificationValue(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Boolean((value as Record<string, unknown>)[key]);
}

export default async function ConfiguracoesPage() {
  const context = await getMemberContext();
  const preferences = context.preferences;

  return (
    <MemberEmptyPage
      description="Suas preferências atuais ficam aqui para que a experiência continue simples, previsível e respeitosa."
      icon={Settings}
      title="Configurações"
    >
      <Card className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Lembrete", preferences?.reminder_time ?? "Nao definido"],
            ["Tema", preferences?.theme ?? "dark"],
            ["Movimento reduzido", preferences?.reduced_motion ? "Ativo" : "Inativo"],
            [
              "Comunicações",
              getNotificationValue(preferences?.notifications, "communication_opt_in")
                ? "Autorizadas"
                : "Nao autorizadas",
            ],
          ].map(([label, value]) => (
            <div
              className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-4"
              key={label}
            >
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
                {label}
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Link
        className="mt-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.035] p-4 transition-colors hover:border-white/14 hover:bg-white/[0.05] focus-visible:outline-action-soft"
        href="/app/configuracoes/notificacoes"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action/12 text-action-soft">
          <Bell aria-hidden="true" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Notificações</span>
          <span className="block text-xs text-muted-2">Lembretes, push e o que você quer receber</span>
        </span>
        <ChevronRight aria-hidden="true" className="shrink-0 text-muted-2" size={16} />
      </Link>
    </MemberEmptyPage>
  );
}
