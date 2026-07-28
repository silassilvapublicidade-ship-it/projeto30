import { Route } from "lucide-react";

import { RhythmRail, type RhythmRailDay } from "@/components/brand/rhythm-rail";
import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMemberContext } from "@/server/services/member-area.service";
import type { Tables } from "@/types/database";

type JourneyDay = Pick<Tables<"challenge_days">, "day_number" | "id" | "theme" | "title">;

type JourneyLog = Pick<
  Tables<"daily_logs">,
  | "challenge_day_id"
  | "completion_percent"
  | "finalized_at"
  | "id"
  | "points_earned"
  | "status"
>;

function buildRailDays({
  currentDay,
  days,
  logsByDayId,
}: {
  currentDay: number;
  days: JourneyDay[];
  logsByDayId: Map<string, JourneyLog>;
}): RhythmRailDay[] {
  return days.map((item) => {
    const log = logsByDayId.get(item.id);

    return {
      day: item.day_number,
      state:
        item.day_number === currentDay
          ? "today"
          : log?.status === "finalized" && Number(log.completion_percent) >= 70
            ? "done"
            : log
              ? "rest"
              : "next",
    };
  });
}

function getDayStatusLabel(
  log: JourneyLog | undefined,
  dayNumber: number,
  currentDay: number,
) {
  if (log?.status === "finalized") {
    return Number(log.completion_percent) >= 100 ? "Completo" : "Finalizado parcial";
  }

  if (log) {
    return "Em andamento";
  }

  if (dayNumber === currentDay) {
    return "Hoje";
  }

  return dayNumber < currentDay ? "Não registrado" : "Futuro";
}

export default async function JornadaPage() {
  const context = await getMemberContext();
  const enrollment = context.activeEnrollment;
  const supabase = await createSupabaseServerClient();
  const [{ data: days }, { data: logs }] = enrollment
    ? await Promise.all([
        supabase
          .from("challenge_days")
          .select("id,day_number,title,theme")
          .eq("challenge_id", enrollment.challenge_id)
          .order("day_number", { ascending: true }),
        supabase
          .from("daily_logs")
          .select(
            "id,challenge_day_id,status,completion_percent,points_earned,finalized_at",
          )
          .eq("enrollment_id", enrollment.id)
          .order("log_date", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];
  const journeyDays = days ?? [];
  const journeyLogs = logs ?? [];
  const logsByDayId = new Map(journeyLogs.map((log) => [log.challenge_day_id, log]));
  const finalizedDays = journeyLogs.filter((log) => log.status === "finalized").length;
  const partialDays = journeyLogs.filter(
    (log) =>
      log.status === "finalized" &&
      Number(log.completion_percent) > 0 &&
      Number(log.completion_percent) < 100,
  ).length;

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
              Dia {enrollment.current_day} desde {enrollment.personal_start_date}. O
              calendário completo saiu da tela Hoje para manter o foco no dia atual.
            </p>
          </div>
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
            <Progress
              label="Conclusão do ciclo"
              value={Math.round(enrollment.completion_percent)}
            />
            <RhythmRail
              days={buildRailDays({
                currentDay: enrollment.current_day,
                days: journeyDays,
                logsByDayId,
              })}
              label="Calendário completo da jornada"
            />
          </div>
          <div className="grid gap-3 border-t border-white/[0.08] p-5 sm:grid-cols-3 sm:p-7">
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/22 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
                Dias finalizados
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {finalizedDays}
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/22 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
                Dias parciais
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{partialDays}</p>
            </div>
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/22 p-4">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
                Sequência
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {enrollment.streak_current} dias
              </p>
            </div>
          </div>
          <div className="border-t border-white/[0.08] p-5 sm:p-7">
            <div className="grid gap-3 md:grid-cols-2">
              {journeyDays.map((day) => {
                const log = logsByDayId.get(day.id);

                return (
                  <div
                    className="rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4"
                    key={day.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-action-soft">
                          Dia {day.day_number}
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-foreground">
                          {day.title ?? day.theme ?? "Jornada do dia"}
                        </h3>
                      </div>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.055] px-3 py-1 text-xs text-muted">
                        {getDayStatusLabel(log, day.day_number, enrollment.current_day)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-2">
                      <span>
                        Progresso:{" "}
                        <strong className="text-foreground">
                          {log ? Math.round(Number(log.completion_percent)) : 0}%
                        </strong>
                      </span>
                      <span>
                        Pontos:{" "}
                        <strong className="text-foreground">
                          {log?.points_earned ?? 0}
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : undefined}
    </MemberEmptyPage>
  );
}
