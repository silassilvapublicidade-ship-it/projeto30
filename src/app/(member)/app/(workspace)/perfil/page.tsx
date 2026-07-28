import { UserRound } from "lucide-react";

import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Card } from "@/components/ui/card";
import { getMemberContext } from "@/server/services/member-area.service";

export default async function PerfilPage() {
  const context = await getMemberContext();
  const profile = context.profile;

  return (
    <MemberEmptyPage
      description="Seu perfil reúne os dados que ajudam o Projeto 30 a tratar sua jornada pelo nome certo."
      icon={UserRound}
      title="Perfil"
    >
      <Card className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Nome", profile.name ?? "Nao informado"],
            ["Exibicao", profile.display_name ?? "Nao informado"],
            ["E-mail", profile.email],
            ["Fuso horario", profile.timezone],
            ["Onboarding", profile.onboarding_completed ? "Concluido" : "Pendente"],
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
