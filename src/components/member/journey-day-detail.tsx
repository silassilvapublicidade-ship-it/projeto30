import { CheckCircle2, Circle, MinusCircle } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import type { JourneyDayDetail } from "@/server/services/journey.service";

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }).format(new Date(value));
}

const stateLabel: Record<JourneyDayDetail["state"], string> = {
  completed: "Completo",
  future: "Bloqueado",
  missed: "Não realizado",
  partial: "Parcial",
  today: "Hoje",
};

const habitStateIcon: Record<JourneyDayDetail["habits"][number]["state"], typeof Circle> = {
  completed: CheckCircle2,
  not_applicable: Circle,
  pending: Circle,
  skipped: MinusCircle,
};

const habitStateLabel: Record<JourneyDayDetail["habits"][number]["state"], string> = {
  completed: "Realizado",
  not_applicable: "Não se aplica",
  pending: "Não realizado",
  skipped: "Pulado",
};

const journalFields: Array<{ key: keyof NonNullable<JourneyDayDetail["journal"]>; label: string }> = [
  { key: "content", label: "Como foi o dia" },
  { key: "gratitude", label: "Gratidão" },
  { key: "difficulty", label: "O que pesou" },
  { key: "victory", label: "O que venceu" },
  { key: "tomorrow_focus", label: "Foco de amanhã" },
  { key: "mood", label: "Humor" },
];

export function JourneyDayDetailPanel({ day }: { day: JourneyDayDetail | null }) {
  if (!day) {
    return (
      <Card tone="glass">
        <EmptyState
          description="Escolha um dia disponível no calendário para ver os detalhes."
          title="Nenhum dia selecionado"
        />
      </Card>
    );
  }

  const journalHasContent =
    day.journal &&
    journalFields.some((field) => Boolean(day.journal?.[field.key]));

  return (
    <Card className="space-y-4" tone="glass">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-action-soft">
            Dia {day.dayNumber} {day.challengeDayTitle ? `· ${day.challengeDayTitle}` : ""}
          </p>
          {day.date ? (
            <p className="mt-1 text-sm capitalize text-muted">{formatFullDate(day.date)}</p>
          ) : null}
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">
          {stateLabel[day.state]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">Progresso</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {Math.round(day.completionPercent)}%
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">Pontos</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{day.pointsEarned}</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">Fechamento</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {day.finalized ? "Finalizado" : "Em aberto"}
          </p>
        </div>
      </div>

      {day.habits.length > 0 ? (
        <div className="space-y-2">
          <CardTitle className="font-mono text-xs uppercase tracking-[0.14em] text-muted-2">
            Hábitos deste dia
          </CardTitle>
          <ul className="space-y-1.5">
            {day.habits.map((habit) => {
              const Icon = habitStateIcon[habit.state];
              return (
                <li
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
                  key={habit.habitId}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        habit.state === "completed" ? "text-action-soft" : "text-muted-2",
                      )}
                      size={15}
                    />
                    <p className="text-sm font-medium text-foreground">{habit.dailyPrompt}</p>
                    <span className="ml-auto font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted-2">
                      {habitStateLabel[habit.state]}
                    </span>
                  </div>
                  {habit.note ? (
                    <p className="mt-1.5 pl-[1.6rem] text-xs leading-5 text-muted">
                      &ldquo;{habit.note}&rdquo;
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {day.dailyLogId ? (
        <div className="space-y-2 border-t border-white/[0.08] pt-3">
          <CardTitle className="font-mono text-xs uppercase tracking-[0.14em] text-muted-2">
            Diário deste dia
          </CardTitle>
          {journalHasContent ? (
            <dl className="grid gap-2 sm:grid-cols-2">
              {journalFields.map((field) =>
                day.journal?.[field.key] ? (
                  <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5" key={field.key}>
                    <dt className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-2">
                      {field.label}
                    </dt>
                    <dd className="mt-1 whitespace-pre-line text-xs leading-5 text-foreground/85">
                      {day.journal[field.key]}
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          ) : (
            <p className="text-xs text-muted-2">Nenhuma anotação salva neste dia.</p>
          )}
        </div>
      ) : null}
    </Card>
  );
}
