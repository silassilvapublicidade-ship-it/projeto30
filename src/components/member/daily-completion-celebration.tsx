"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Flame, Route, Sparkles, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { recordDailyCompletionEventAction } from "@/features/member/journey.actions";
import { describeStreakBest, describeStreakOutcome } from "@/features/journey/streak-explanation.core";
import type { FinalizeDaySummary } from "@/features/member/journey.actions";
import type { TodayMission } from "@/server/services/member-area.service";

export type DailyCompletionCelebrationProps = {
  challengeMessage: string;
  dayNumber: number;
  enrollmentId: string;
  missions: TodayMission[];
  onOpenAchievements: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  summary: FinalizeDaySummary;
};

/**
 * The "your day was saved" moment (Parte B) - opens exactly once, right
 * after a FRESH finalize (never on revisit/reload, see
 * today-interactive-section.tsx's justFinalized distinction). Achievements
 * are never hidden inside here (Parte 9): if any unlocked, a highlighted
 * section says so and "Ver conquista" hands off to the existing
 * AchievementUnlockModal (untouched) for the real animation/share flow,
 * rather than duplicating that logic here.
 */
export function DailyCompletionCelebration({
  challengeMessage,
  dayNumber,
  enrollmentId,
  missions,
  onOpenAchievements,
  onOpenChange,
  open,
  summary,
}: DailyCompletionCelebrationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const router = useRouter();
  const missionsById = new Map(missions.map((mission) => [mission.habitId, mission]));

  const realized = summary.habitResults.filter((item) => item.status === "completed");
  const notRealized = summary.habitResults.filter((item) => item.status === "pending");
  const hasAchievements = summary.unlockedAchievements.length > 0;
  const streakOutcome = describeStreakOutcome({
    completionPercent: summary.completionPercent,
    streakCurrent: summary.streakCurrent,
    streakMinimumCompletion: summary.streakMinimumCompletion,
  });
  const streakBestMessage = describeStreakBest({
    streakBest: summary.streakBest,
    streakCurrent: summary.streakCurrent,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      void recordDailyCompletionEventAction("daily_completion_summary_viewed", enrollmentId);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, enrollmentId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function handleClose() {
      onOpenChange(false);
    }

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onOpenChange]);

  function handleContinue() {
    void recordDailyCompletionEventAction("daily_completion_continue_clicked", enrollmentId);
    onOpenChange(false);
  }

  function handleViewJourney() {
    void recordDailyCompletionEventAction("daily_completion_journey_clicked", enrollmentId);
    onOpenChange(false);
    router.push("/app/jornada");
  }

  function handleViewAchievements() {
    void recordDailyCompletionEventAction("daily_completion_share_clicked", enrollmentId);
    onOpenChange(false);
    onOpenAchievements();
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto h-full max-h-full w-full max-w-lg overflow-y-auto rounded-none border-0 bg-matte/98 p-0 text-foreground shadow-[var(--shadow-lift)] backdrop:bg-black/78 sm:h-auto sm:max-h-[90vh] sm:rounded-[var(--radius-card)] sm:border sm:border-white/[0.10]"
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
      ref={dialogRef}
    >
      <div className="safe-top safe-bottom flex min-h-full flex-col p-5 sm:min-h-0 sm:p-7">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-full border border-action/30 bg-action/14 text-action-soft [animation:p30-unlock-glow_700ms_var(--ease-premium)]">
            <CheckCircle2 aria-hidden="true" size={28} />
          </span>
          <h2 className="mt-4 font-display text-2xl text-foreground" id={titleId}>
            Dia {dayNumber} concluído.
          </h2>
          <p className="mt-1 text-sm text-muted">Seu progresso foi salvo com segurança.</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-[1.25rem] border border-action/24 bg-action/[0.08] p-4 text-center">
            <p className="font-display text-3xl text-foreground">{summary.pointsEarned}</p>
            <p className="mt-1 text-xs text-muted">pontos conquistados</p>
          </div>
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-center">
            <p className="font-display text-3xl text-foreground">{realized.length}</p>
            <p className="mt-1 text-xs text-muted">hábitos realizados</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-[1.1rem] border border-white/[0.08] bg-white/[0.03] p-3.5">
          <Flame
            aria-hidden="true"
            className={streakOutcome.metMinimum ? "text-action-soft" : "text-muted-2"}
            size={18}
          />
          <p className="text-sm leading-5 text-foreground">
            {streakOutcome.message}
            {streakBestMessage ? <span className="text-muted"> {streakBestMessage}</span> : null}
          </p>
        </div>

        {hasAchievements ? (
          <div className="mt-3 rounded-[1.1rem] border border-action/28 bg-action/[0.08] p-3.5">
            <div className="flex items-center gap-2">
              <Trophy aria-hidden="true" className="text-action-soft" size={18} />
              <p className="text-sm font-semibold text-foreground">
                {summary.unlockedAchievements.length === 1
                  ? "Nova conquista desbloqueada"
                  : `${summary.unlockedAchievements.length} novas conquistas desbloqueadas`}
              </p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              {summary.unlockedAchievements.map((achievement) => achievement.name).join(" · ")}
            </p>
            <Button
              className="mt-2.5"
              leadingIcon={<Sparkles aria-hidden="true" size={13} />}
              onClick={handleViewAchievements}
              size="xs"
              type="button"
            >
              Ver conquista{summary.unlockedAchievements.length > 1 ? "s" : ""}
            </Button>
          </div>
        ) : null}

        {realized.length > 0 ? (
          <div className="mt-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-action-soft">Realizados</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {realized.map((item) => (
                <span
                  className="rounded-full border border-action/24 bg-action/[0.06] px-2.5 py-1 text-xs text-foreground"
                  key={item.habitId}
                >
                  {missionsById.get(item.habitId)?.dailyPrompt ?? "Hábito"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {notRealized.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer select-none text-xs font-medium text-muted-2">
              {notRealized.length} hábito{notRealized.length > 1 ? "s" : ""} não realizado
              {notRealized.length > 1 ? "s" : ""} hoje
            </summary>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {notRealized.map((item) => (
                <span
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-muted"
                  key={item.habitId}
                >
                  {missionsById.get(item.habitId)?.dailyPrompt ?? "Hábito"}
                </span>
              ))}
            </div>
          </details>
        ) : null}

        <blockquote className="mt-5 border-l-2 border-action/40 pl-3 text-sm italic leading-6 text-muted">
          {challengeMessage}
        </blockquote>

        <div className="mt-auto flex flex-col gap-2 pt-6 sm:flex-row">
          <Button className="sm:flex-1" onClick={handleContinue} size="md" type="button">
            Continuar
          </Button>
          <Button
            className="sm:flex-1"
            leadingIcon={<Route aria-hidden="true" size={14} />}
            onClick={handleViewJourney}
            size="md"
            type="button"
            variant="secondary"
          >
            Ver Jornada
          </Button>
        </div>
      </div>
    </dialog>
  );
}
