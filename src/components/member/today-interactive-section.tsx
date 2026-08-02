"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Flame, MessageSquare, Save, XCircle } from "lucide-react";

import { useUnsavedChangesGuard } from "@/components/member/use-unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatusCard } from "@/components/ui/feedback";
import {
  finalizeDayWithResponsesAction,
  saveJournalEntryAction,
  type FinalizeDaySummary,
} from "@/features/member/journey.actions";
import { calculateDailyProgress } from "@/features/journey/progress.core";
import {
  buildFinalizeResponses,
  buildInitialLocalState,
  countPendingHabits,
  hasUnsavedChanges,
  setHabitNote,
  setHabitStatus,
  toProgressInput,
  type LocalHabitStatus,
  type LocalHabitsState,
} from "@/features/journey/today-local-state.core";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";
import type { TodayMission } from "@/server/services/member-area.service";

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

const missionStateClassName: Record<LocalHabitStatus, string> = {
  completed: "border-action/38 bg-action/16 text-action-soft",
  not_applicable: "border-white/10 bg-white/[0.05] text-muted",
  not_realized: "border-white/[0.14] bg-white/[0.06] text-muted",
  pending: "border-white/[0.10] bg-white/[0.045] text-muted",
};

const statusLabel: Record<LocalHabitStatus, string> = {
  completed: "Realizado",
  not_applicable: "Não se aplica",
  not_realized: "Não realizado",
  pending: "Ainda não respondido",
};

function MissionGlyph({ status }: { status: LocalHabitStatus }) {
  if (status === "completed") {
    return <CheckCircle2 aria-hidden="true" size={16} />;
  }

  if (status === "not_realized") {
    return <XCircle aria-hidden="true" size={16} />;
  }

  return <span aria-hidden="true" className="block size-2 rounded-full bg-current opacity-60" />;
}

function MissionRow({
  editable,
  entry,
  mission,
  onNoteChange,
  onStatusChange,
}: {
  editable: boolean;
  entry: LocalHabitsState[string];
  mission: TodayMission;
  onNoteChange: (note: string) => void;
  onStatusChange: (status: LocalHabitStatus) => void;
}) {
  const isPeriodHabit = mission.frequencyType !== "daily";
  const frequencyBadgeLabel =
    mission.frequencyType === "weekly"
      ? "Meta semanal"
      : mission.frequencyType === "monthly"
        ? "Meta mensal"
        : null;

  return (
    <li>
      <div
        className={cn(
          "rounded-lg border border-white/[0.08] bg-white/[0.035] p-2.5 transition-[background,border-color] duration-[var(--motion-base)] ease-[var(--ease-premium)]",
          entry.status === "completed" && "border-action/28 bg-action/[0.05]",
        )}
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border",
              missionStateClassName[entry.status],
            )}
          >
            <MissionGlyph status={entry.status} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold leading-5 text-foreground">{mission.dailyPrompt}</h3>
              <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted-2">
                {mission.required ? "Essencial" : "Opcional"}
              </span>
              {frequencyBadgeLabel ? (
                <span className="rounded-full border border-action/28 bg-action/10 px-1.5 py-0.5 font-mono text-[0.56rem] uppercase tracking-[0.1em] text-action-soft">
                  {frequencyBadgeLabel}
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-4 text-muted-2">
              <span
                className={cn(
                  "font-semibold",
                  entry.status === "completed" ? "text-action-soft" : "text-muted",
                )}
              >
                {statusLabel[entry.status]}
              </span>{" "}
              · {mission.goalLabel ?? mission.targetLabel}
            </p>
            {isPeriodHabit && mission.periodProgress ? (
              <p className="mt-0.5 text-xs leading-4 text-muted-2">
                {mission.periodProgress.completed}
                {mission.periodProgress.target !== null ? ` de ${mission.periodProgress.target}` : ""}{" "}
                {mission.frequencyType === "weekly" ? "concluídos esta semana" : "concluídos este mês"}
                {" "}· não conta como obrigação de hoje
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2 rounded-md border border-white/[0.05] bg-black/15 p-1.5">
          <details className="group" open={Boolean(entry.note)}>
            <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-muted-2 transition-colors hover:text-foreground">
              <MessageSquare aria-hidden="true" size={12} />
              {entry.note ? "Comentário adicionado · editar" : "Adicionar comentário"}
            </summary>
            <textarea
              aria-label="Comentário opcional"
              className="mt-1.5 min-h-14 w-full resize-none rounded-[10px] border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 text-sm leading-5 text-foreground outline-none transition-[border-color,background,box-shadow] duration-[var(--motion-base)] placeholder:text-muted-2 focus:border-action/60 focus:shadow-[0_0_0_3px_rgba(255,106,0,0.1)] disabled:opacity-45"
              disabled={!editable}
              maxLength={1200}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Ex.: fiz 30 minutos de caminhada"
              value={entry.note}
            />
          </details>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button
              disabled={!editable}
              leadingIcon={<CheckCircle2 aria-hidden="true" size={12} />}
              onClick={() => onStatusChange("completed")}
              size="xs"
              type="button"
              variant={entry.status === "completed" ? "primary" : "secondary"}
            >
              Realizado
            </Button>
            <Button
              disabled={!editable}
              leadingIcon={<XCircle aria-hidden="true" size={12} />}
              onClick={() => onStatusChange("not_realized")}
              size="xs"
              type="button"
              variant={entry.status === "not_realized" ? "danger" : "ghost"}
            >
              Não realizado
            </Button>
            {!mission.required ? (
              <Button
                disabled={!editable}
                onClick={() => onStatusChange("not_applicable")}
                size="xs"
                type="button"
                variant={entry.status === "not_applicable" ? "secondary" : "ghost"}
              >
                Não se aplica
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

type DisplaySummary = {
  finalizedAt: string | null;
  habitResults: FinalizeDaySummary["habitResults"];
  justFinalized: boolean;
  pointsEarned: number;
  streakCurrent: number;
  unlockedAchievements: FinalizeDaySummary["unlockedAchievements"];
};

function formatFinalizedTime(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(parsed);
}

/**
 * Renders both right after a fresh finalize (rich data straight from the
 * RPC response) AND when reopening an already-finalized day from a previous
 * session (habitResults rebuilt from the persisted habit_logs the page
 * already loaded - see today-interactive-section's displaySummary). The
 * only field that's genuinely unavailable on reopen is which achievements
 * unlocked THIS finalize specifically - that list is simply empty then,
 * never guessed.
 */
function FinalizeSummaryPanel({
  missions,
  summary,
}: {
  missions: TodayMission[];
  summary: DisplaySummary;
}) {
  const missionsById = new Map(missions.map((mission) => [mission.habitId, mission]));
  const realized = summary.habitResults.filter((item) => item.status === "completed");
  const notRealized = summary.habitResults.filter((item) => item.status === "pending");
  const notApplicable = summary.habitResults.filter((item) => item.status === "not_applicable");
  const hasPeriodHabitRealized = realized.some(
    (item) => missionsById.get(item.habitId)?.frequencyType !== "daily",
  );
  const finalizedTime = formatFinalizedTime(summary.finalizedAt);

  return (
    <section className="space-y-3 rounded-xl border border-action/24 bg-action/[0.06] p-4 sm:p-5">
      <div>
        <h2 className="font-display text-lg text-foreground">Dia finalizado.</h2>
        <p className="text-sm leading-6 text-muted">
          {summary.pointsEarned} pontos conquistados{summary.justFinalized ? " hoje" : ""} · sequência atual
          de {summary.streakCurrent} {summary.streakCurrent === 1 ? "dia" : "dias"}
          {finalizedTime ? ` · finalizado às ${finalizedTime}` : ""}.
        </p>
      </div>

      {realized.length > 0 ? (
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-action-soft">Realizados</p>
          <ul className="mt-1 space-y-0.5 text-sm text-foreground">
            {realized.map((item) => (
              <li key={item.habitId}>· {missionsById.get(item.habitId)?.dailyPrompt ?? "Hábito"}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notRealized.length > 0 ? (
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-2">Não realizados</p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted">
            {notRealized.map((item) => (
              <li key={item.habitId}>· {missionsById.get(item.habitId)?.dailyPrompt ?? "Hábito"}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notApplicable.length > 0 ? (
        <p className="text-xs text-muted-2">
          {notApplicable.length} {notApplicable.length === 1 ? "hábito marcado" : "hábitos marcados"} como não
          aplicável.
        </p>
      ) : null}

      {hasPeriodHabitRealized ? (
        <p className="text-xs text-muted-2">
          Progresso das metas semanais/mensais atualizado - confira em Jornada.
        </p>
      ) : null}

      {summary.unlockedAchievements.length > 0 ? (
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-action-soft">
            Conquistas desbloqueadas
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-foreground">
            {summary.unlockedAchievements.map((achievement) => (
              <li key={achievement.id}>· {achievement.name}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function TodayInteractiveSection({
  dailyLogId,
  durationDays,
  initialFinalized,
  initialFinalizedAt,
  initialPointsEarned,
  initialStreakCurrent,
  journalEntry,
  missions,
  pointsPotential,
}: {
  dailyLogId: string | null;
  durationDays: number;
  initialFinalized: boolean;
  initialFinalizedAt: string | null;
  initialPointsEarned: number;
  initialStreakCurrent: number;
  journalEntry: Pick<
    Tables<"journal_entries">,
    "content" | "difficulty" | "gratitude" | "mood" | "tomorrow_focus" | "victory"
  > | null;
  missions: TodayMission[];
  pointsPotential: number;
}) {
  const [baseline] = useState(() =>
    buildInitialLocalState(
      missions.map((mission) => ({
        frequencyType: mission.frequencyType,
        habitId: mission.habitId,
        note: mission.note,
        required: mission.required,
        state: mission.state,
      })),
    ),
  );
  const [habitsState, setHabitsState] = useState(baseline);
  const [finalized, setFinalized] = useState(initialFinalized);
  const [summary, setSummary] = useState<FinalizeDaySummary | null>(null);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const editable = Boolean(dailyLogId) && !finalized;
  const unsaved = editable && hasUnsavedChanges(habitsState, baseline);
  useUnsavedChangesGuard(
    unsaved,
    "Você possui alterações que ainda não foram salvas. Finalize o dia ou continue editando.",
  );

  const progress = useMemo(
    () =>
      calculateDailyProgress({
        finalized,
        habits: toProgressInput(habitsState),
      }),
    [habitsState, finalized],
  );
  const pendingCount = countPendingHabits(habitsState);

  // Right after a fresh finalize, `summary` (the RPC's own rich response) is
  // authoritative. Reopening an already-finalized day from a previous
  // session has no fresh RPC response to show, but the per-habit outcomes
  // are still real - they're exactly what buildInitialLocalState seeded
  // from the persisted habit_logs the page already loaded, so they're
  // rebuilt from habitsState instead of re-fetched. Achievements unlocked
  // by that past finalize aren't known without a fresh query, so that list
  // is simply empty on reopen - never guessed.
  const displaySummary: DisplaySummary | null = summary
    ? {
        finalizedAt: initialFinalizedAt,
        habitResults: summary.habitResults,
        justFinalized: true,
        pointsEarned: summary.pointsEarned,
        streakCurrent: summary.streakCurrent,
        unlockedAchievements: summary.unlockedAchievements,
      }
    : initialFinalized
      ? {
          finalizedAt: initialFinalizedAt,
          habitResults: Object.entries(habitsState).map(([habitId, entry]) => ({
            habitId,
            status: entry.status === "not_realized" ? "pending" : entry.status,
          })),
          justFinalized: false,
          pointsEarned: initialPointsEarned,
          streakCurrent: initialStreakCurrent,
          unlockedAchievements: [],
        }
      : null;

  async function runFinalize() {
    if (!dailyLogId || isFinalizing) {
      return;
    }

    setIsFinalizing(true);
    setErrorMessage(null);

    const responses = buildFinalizeResponses(habitsState);
    const result = await finalizeDayWithResponsesAction(dailyLogId, responses);

    setIsFinalizing(false);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setSummary(result.summary);
    setFinalized(true);
    setPendingModalOpen(false);
  }

  function handleFinalizeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingCount > 0) {
      setPendingModalOpen(true);
      return;
    }

    void runFinalize();
  }

  return (
    <>
      <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-center gap-3">
          <p className="font-display text-2xl leading-none text-foreground">
            {clampPercent(progress.completionPercent)}
            <span className="text-xs font-normal text-muted-2">%</span>
          </p>
          <div className="min-w-0 flex-1">
            <div
              aria-label="Progresso do dia"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={clampPercent(progress.completionPercent)}
              className="h-2 w-full overflow-visible rounded-full bg-white/10"
              role="progressbar"
            >
              <div
                className="relative h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))] transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-premium)]"
                style={{ width: `${clampPercent(progress.completionPercent)}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">
              {durationDays} dias no ciclo
            </p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-2">
          <span>
            {progress.completedHabits}/{progress.applicableHabits} hábitos
          </span>
          <span>
            {displaySummary?.pointsEarned ?? 0}/{pointsPotential} pts
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame aria-hidden="true" className="text-action-soft" size={12} />
            {displaySummary?.streakCurrent ?? initialStreakCurrent}d sequência
          </span>
        </div>

        {unsaved ? (
          <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-action-soft">
            Alterações serão salvas ao finalizar o dia.
          </p>
        ) : null}
      </div>

      {displaySummary ? (
        <div className="mt-3">
          <FinalizeSummaryPanel missions={missions} summary={displaySummary} />
        </div>
      ) : null}

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft">Missões do dia</h2>
          <span className="text-xs text-muted">{missions.length} ativas</span>
        </div>

        {missions.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {missions.map((mission) => {
              const entry = habitsState[mission.habitId];

              if (!entry) {
                return null;
              }

              return (
                <MissionRow
                  editable={editable}
                  entry={entry}
                  key={mission.id}
                  mission={mission}
                  onNoteChange={(note) =>
                    setHabitsState((current) => setHabitNote(current, mission.habitId, note))
                  }
                  onStatusChange={(status) =>
                    setHabitsState((current) => setHabitStatus(current, mission.habitId, status))
                  }
                />
              );
            })}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.03] p-6">
            <p className="max-w-xl text-sm leading-6 text-muted">
              Nenhuma missão foi publicada para este dia. Quando o ciclo tiver hábitos configurados, eles
              aparecerão aqui sem tarefas inventadas.
            </p>
          </div>
        )}
      </div>

      <ReflectionSection dailyLogId={dailyLogId} editable={editable} entry={journalEntry} />

      <section className="mt-4 rounded-xl border border-action/16 bg-action/[0.045] p-3 sm:p-4">
        {errorMessage ? (
          <div className="mb-3">
            <StatusCard description={errorMessage} title="Não foi possível finalizar" tone="error" />
          </div>
        ) : null}

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          onSubmit={handleFinalizeSubmit}
        >
          <p className="text-xs leading-5 text-muted">
            <span className="font-semibold text-foreground">
              {progress.completedHabits} de {progress.applicableHabits}
            </span>{" "}
            hábitos aplicáveis. A finalização calcula pontos, sequência e conquistas no servidor e bloqueia
            edições depois.
          </p>
          <div className="flex flex-col gap-2 sm:w-64 sm:shrink-0">
            <Checkbox
              checked={confirmChecked}
              description="Entendo que o dia será fechado com as regras atuais do ciclo."
              disabled={!editable}
              label="Confirmar finalização"
              onChange={(event) => setConfirmChecked(event.target.checked)}
              required
            />
            <Button
              disabled={!editable || isFinalizing}
              leadingIcon={<CheckCircle2 aria-hidden="true" size={14} />}
              loading={isFinalizing}
              size="sm"
              type="submit"
            >
              {finalized ? "Dia finalizado" : isFinalizing ? "Finalizando..." : "Finalizar o dia"}
            </Button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        confirmLabel="Finalizar mesmo assim"
        description="Você ainda não respondeu todos os hábitos. Os itens pendentes serão registrados como não realizados e não gerarão pontuação."
        formAction={() => runFinalize()}
        onOpenChange={setPendingModalOpen}
        open={pendingModalOpen}
        title="Finalizar com hábitos pendentes?"
      />
    </>
  );
}

function ReflectionSection({
  dailyLogId,
  editable,
  entry,
}: {
  dailyLogId: string | null;
  editable: boolean;
  entry: Pick<
    Tables<"journal_entries">,
    "content" | "difficulty" | "gratitude" | "mood" | "tomorrow_focus" | "victory"
  > | null;
}) {
  const hasEntry = Boolean(
    entry?.content || entry?.gratitude || entry?.difficulty || entry?.victory || entry?.tomorrow_focus || entry?.mood,
  );

  return (
    <section className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-action-soft">
          <Save aria-hidden="true" size={15} />
        </span>
        <div>
          <h2 className="font-display text-base text-foreground">Seu diário de hoje.</h2>
          <p className="text-xs leading-4 text-muted-2">Sem filtro. Ninguém mais lê isso além de você.</p>
        </div>
      </div>

      <form action={saveJournalEntryAction} className="mt-4 space-y-2.5">
        <input name="dailyLogId" type="hidden" value={dailyLogId ?? ""} />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">Como foi o meu dia?</span>
            <textarea
              className="mt-2 min-h-16 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.content ?? ""}
              disabled={!editable}
              name="content"
              placeholder="Escreva como se ninguém fosse ler."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">Pelo que sou grato hoje?</span>
            <textarea
              className="mt-2 min-h-16 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.gratitude ?? ""}
              disabled={!editable}
              name="gratitude"
              placeholder="Algo pequeno que merece ficar."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">O que pesou hoje?</span>
            <textarea
              className="mt-2 min-h-14 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.difficulty ?? ""}
              disabled={!editable}
              name="difficulty"
              placeholder="O ponto que pediu mais presença."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">O que eu venci hoje?</span>
            <textarea
              className="mt-2 min-h-14 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.victory ?? ""}
              disabled={!editable}
              name="victory"
              placeholder="Mesmo pequeno, conta."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">Amanhã, eu quero...</span>
            <textarea
              className="mt-2 min-h-14 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.tomorrow_focus ?? ""}
              disabled={!editable}
              name="tomorrowFocus"
              placeholder="Uma direção simples para o próximo dia."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">Como estou me sentindo?</span>
            <input
              className="mt-2 min-h-9 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.mood ?? ""}
              disabled={!editable}
              name="mood"
              placeholder="Ex.: sereno, cansado, grato"
              type="text"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-4 text-muted-2">
            {hasEntry
              ? "Reflexão salva no diário privado deste ciclo."
              : "Nada salvo ainda. O texto só sai do aparelho ao tocar em salvar."}
          </p>
          <Button
            disabled={!editable}
            leadingIcon={<Save aria-hidden="true" size={14} />}
            size="sm"
            type="submit"
            variant="secondary"
          >
            Salvar reflexão
          </Button>
        </div>
      </form>
    </section>
  );
}
