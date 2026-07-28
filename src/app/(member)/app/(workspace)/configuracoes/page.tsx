import { Settings } from "lucide-react";

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
    </MemberEmptyPage>
  );
}
