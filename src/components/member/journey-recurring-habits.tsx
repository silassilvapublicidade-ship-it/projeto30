import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  computeRecurringProgressPercent,
  formatRecurringProgressLabel,
} from "@/features/journey/recurring-habit-progress.core";
import type { JourneyRecurringHabitProgress } from "@/server/services/journey.service";

const frequencyGroupTitle: Record<JourneyRecurringHabitProgress["frequencyType"], string> = {
  daily: "Adesão no ciclo",
  monthly: "Metas do mês",
  weekly: "Metas da semana",
};

/**
 * "Meta vs execução" made visible over time, not just today: cada hábito
 * mostra quanto já foi cumprido da meta recorrente (semana/mês) ou a adesão
 * acumulada no ciclo (hábitos diários) - o usuário nunca precisa somar isso
 * de cabeça, o motor já soma (getRecurringHabitProgress).
 */
export function JourneyRecurringHabits({
  habits,
}: {
  habits: JourneyRecurringHabitProgress[];
}) {
  if (habits.length === 0) {
    return null;
  }

  const groups: Array<{
    frequencyType: JourneyRecurringHabitProgress["frequencyType"];
    items: JourneyRecurringHabitProgress[];
  }> = (["weekly", "monthly", "daily"] as const)
    .map((frequencyType) => ({
      frequencyType,
      items: habits.filter((habit) => habit.frequencyType === frequencyType),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Card className="space-y-4" tone="glass">
      <CardTitle className="font-mono text-xs uppercase tracking-[0.14em] text-muted-2">
        Metas recorrentes
      </CardTitle>

      <div className="space-y-4">
        {groups.map((group) => (
          <div className="space-y-3" key={group.frequencyType}>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">
              {frequencyGroupTitle[group.frequencyType]}
            </p>
            <div className="space-y-3">
              {group.items.map((habit) => {
                const percent = computeRecurringProgressPercent(habit);
                const progressLabel = formatRecurringProgressLabel(habit);

                return percent === null ? (
                  <div className="flex items-center justify-between gap-3 text-xs text-muted" key={habit.habitId}>
                    <span>{habit.label}</span>
                    <span className="font-mono text-foreground">{progressLabel}</span>
                  </div>
                ) : (
                  <Progress
                    key={habit.habitId}
                    label={`${habit.label} · ${progressLabel}`}
                    value={percent}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
