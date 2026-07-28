import { Route } from "lucide-react";

import { RhythmRail, type RhythmRailDay } from "@/components/brand/rhythm-rail";
import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getMemberContext } from "@/server/services/member-area.service";

function buildRailDays(currentDay: number, durationDays: number): RhythmRailDay[] {
  return Array.from({ length: Math.max(1, Math.min(durationDays, 60)) }, (_, index) => {
    const day = index + 1;

    return {
      day,
      state:
        day < currentDay
          ? "done"
          : day === currentDay
            ? "today"
            : day % 7 === 0
              ? "rest"
              : "next",
    };
  });
}

export default async function JornadaPage() {
  const context = await getMemberContext();
  const enrollment = context.activeEnrollment;

  return (
    <MemberEmptyPage
      description="Aqui fica o mapa completo do ciclo: dias vividos, dia atual e próximos passos preservados sem misturar com a experiência diária."
      icon={Route}
      title="Minha jornada"
    >
      {enrollment ? (
        <Card tone="glass" className="overflow-hidden p-0">
          <div className="border-b border-white/[0.08] p-5 sm:p-7">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
              Mapa do ciclo
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-foreground">
              {enrollment.challenge?.name ?? "Ciclo ativo"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Dia {enrollment.current_day} desde {enrollment.personal_start_date}.
              O calendário completo saiu da tela Hoje para manter o foco no dia atual.
            </p>
          </div>
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <Progress
              label="Conclusão do ciclo"
              value={Math.round(enrollment.completion_percent)}
            />
            <RhythmRail
              days={buildRailDays(
                enrollment.current_day,
                enrollment.challenge?.duration_days ?? 30,
              )}
              label="Calendário completo da jornada"
            />
          </div>
        </Card>
      ) : undefined}
    </MemberEmptyPage>
  );
}
