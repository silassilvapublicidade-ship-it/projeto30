import type { CSSProperties } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Droplets,
  Dumbbell,
  Flame,
  Heart,
  Moon,
  PenLine,
  Route,
  Save,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { StatusCard } from "@/components/ui/feedback";
import {
  finalizeDailyLogAction,
  saveJournalEntryAction,
  updateHabitLogAction,
} from "@/features/member/journey.actions";
import { joinAvailableChallengeAction } from "@/features/member/member.actions";
import { cn } from "@/lib/utils";
import type {
  MemberContext,
  TodayMission,
  TodayMissionState,
} from "@/server/services/member-area.service";

export type TodayJourneyNotice = {
  description: string;
  title: string;
  tone: "error" | "success";
};

function firstName(name: string) {
  return name.split(" ").filter(Boolean)[0] ?? name;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getMissionValue(value: unknown) {
  if (!isJsonRecord(value)) {
    return "";
  }

  const storedValue = value.value;

  if (typeof storedValue === "number" || typeof storedValue === "string") {
    return String(storedValue);
  }

  return "";
}

function getCompletionTone(progress: number) {
  if (progress >= 100) {
    return {
      eyebrow: "Dia completo",
      phrase: "Constância registrada. Amanhã começa mais leve.",
    };
  }

  if (progress > 0) {
    return {
      eyebrow: "Dia em movimento",
      phrase: "Não precisa ser perfeito. Precisa continuar real.",
    };
  }

  return {
    eyebrow: "Dia aberto",
    phrase: "Um gesto honesto já muda o ritmo do dia.",
  };
}

function getMissionIconKey(
  mission: TodayMission,
): "book" | "droplets" | "dumbbell" | "heart" | "moon" | "pen" | "sparkles" {
  const text = [mission.icon, mission.category, mission.title, mission.habitType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("agua") || text.includes("água") || text.includes("water")) {
    return "droplets";
  }

  if (
    text.includes("treino") ||
    text.includes("exercicio") ||
    text.includes("exercício") ||
    text.includes("workout")
  ) {
    return "dumbbell";
  }

  if (text.includes("sono") || text.includes("sleep") || text.includes("descanso")) {
    return "moon";
  }

  if (
    text.includes("gratidao") ||
    text.includes("gratidão") ||
    text.includes("oracao") ||
    text.includes("oração") ||
    text.includes("fe") ||
    text.includes("fé")
  ) {
    return "heart";
  }

  if (mission.habitType === "reading" || text.includes("leitura")) {
    return "book";
  }

  if (mission.habitType === "text") {
    return "pen";
  }

  return "sparkles";
}

function MissionGlyph({ mission }: { mission: TodayMission }) {
  const iconKey = getMissionIconKey(mission);
  const props = { "aria-hidden": true, size: 20 };

  if (iconKey === "droplets") {
    return <Droplets {...props} />;
  }

  if (iconKey === "dumbbell") {
    return <Dumbbell {...props} />;
  }

  if (iconKey === "moon") {
    return <Moon {...props} />;
  }

  if (iconKey === "heart") {
    return <Heart {...props} />;
  }

  if (iconKey === "book") {
    return <BookOpen {...props} />;
  }

  if (iconKey === "pen") {
    return <PenLine {...props} />;
  }

  return <Sparkles {...props} />;
}

const missionStateClassName: Record<TodayMissionState, string> = {
  completed: "border-success/30 bg-success/12 text-success",
  in_progress: "border-action/32 bg-action/12 text-action-soft",
  not_applicable: "border-white/10 bg-white/[0.05] text-muted",
  pending: "border-white/[0.10] bg-white/[0.045] text-muted",
  skipped: "border-warning/28 bg-warning/10 text-warning",
};

const missionRailClassName: Record<TodayMissionState, string> = {
  completed: "bg-success",
  in_progress: "bg-action-soft",
  not_applicable: "bg-white/20",
  pending: "bg-white/14",
  skipped: "bg-warning",
};

function TodayRhythmSignature({
  currentDay,
  durationDays,
  progress,
}: {
  currentDay: number;
  durationDays: number;
  progress: number;
}) {
  const safeProgress = clampPercent(progress);
  const rhythmIndex = Math.max(1, Math.min(durationDays, currentDay));
  const slats = Array.from({ length: 9 }, (_, index) => index);

  return (
    <div className="relative mx-auto w-full max-w-sm pt-4">
      <div
        aria-label="Progresso do dia"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={safeProgress}
        className="relative mx-auto grid size-64 place-items-center rounded-full"
        role="progressbar"
        style={
          {
            "--today-progress": `${safeProgress * 3.6}deg`,
          } as CSSProperties
        }
      >
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_210deg,var(--p30-orange)_0deg,var(--p30-orange-soft)_var(--today-progress),rgba(255,255,255,0.08)_var(--today-progress),rgba(255,255,255,0.08)_360deg)] p-[1px]">
          <div className="size-full rounded-full bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.08),rgba(5,5,5,0.92)_58%)]" />
        </div>
        <div className="relative z-10 text-center">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
            Hoje
          </p>
          <p className="mt-3 font-display text-7xl leading-none text-foreground">
            {safeProgress}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-2">%</p>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-xs items-end justify-center gap-2">
        {slats.map((item) => {
          const distance = Math.abs(item - 4);
          const active = item <= 4;

          return (
            <span
              aria-hidden="true"
              className={cn(
                "w-1.5 rounded-[var(--radius-pill)] transition-transform duration-[var(--motion-base)]",
                active ? "bg-action-soft" : "bg-white/12",
                distance === 0 ? "h-12" : distance === 1 ? "h-9" : "h-6",
              )}
              key={item}
            />
          );
        })}
      </div>
      <p className="mt-4 text-center font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
        Dia {rhythmIndex} de {durationDays}
      </p>
    </div>
  );
}

function MissionRow({
  dailyLogId,
  editable,
  mission,
}: {
  dailyLogId: string | null;
  editable: boolean;
  mission: TodayMission;
}) {
  const completed = mission.state === "completed";
  const supportsValue =
    mission.habitType === "quantity" || mission.habitType === "duration";
  const disabled = !dailyLogId || !editable;

  return (
    <li>
      <div
        className={cn(
          "group relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-4 transition-[background,border-color,transform] duration-[var(--motion-base)] ease-[var(--ease-premium)] hover:-translate-y-0.5 hover:border-white/16 hover:bg-white/[0.055]",
          completed && "border-success/24 bg-success/[0.055]",
        )}
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full border",
              missionStateClassName[mission.state],
            )}
          >
            <MissionGlyph mission={mission} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold leading-6 text-foreground">
                {mission.title}
              </h3>
              {mission.required ? (
                <span className="rounded-full border border-white/[0.08] px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-2">
                  Essencial
                </span>
              ) : (
                <span className="rounded-full border border-white/[0.08] px-2 py-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-2">
                  Opcional
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">
              {mission.description ?? mission.targetLabel}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-foreground">
                {mission.targetLabel}
              </span>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  missionStateClassName[mission.state],
                )}
              >
                {mission.statusLabel}
              </span>
            </div>
          </div>
        </div>

        <form
          action={updateHabitLogAction}
          className="mt-5 rounded-[1.1rem] border border-white/[0.07] bg-black/20 p-3"
        >
          <input name="dailyLogId" type="hidden" value={dailyLogId ?? ""} />
          <input name="habitId" type="hidden" value={mission.habitId} />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            {supportsValue ? (
              <label className="block">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">
                  Valor
                </span>
                <input
                  className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-3 text-sm text-foreground outline-none transition-[border-color,background,box-shadow] duration-[var(--motion-base)] placeholder:text-muted-2 focus:border-action/70 focus:shadow-[0_0_0_4px_rgba(255,106,0,0.12)] disabled:opacity-45"
                  defaultValue={getMissionValue(mission.valueJson)}
                  disabled={disabled}
                  inputMode="decimal"
                  min="0"
                  name="value"
                  placeholder={
                    mission.habitType === "duration" ? "Minutos" : "Quantidade"
                  }
                  step="0.01"
                  type="number"
                />
              </label>
            ) : null}
            <label className={cn("block", !supportsValue && "sm:col-span-2")}>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">
                Nota opcional
              </span>
              <input
                className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-3 text-sm text-foreground outline-none transition-[border-color,background,box-shadow] duration-[var(--motion-base)] placeholder:text-muted-2 focus:border-action/70 focus:shadow-[0_0_0_4px_rgba(255,106,0,0.12)] disabled:opacity-45"
                defaultValue={mission.note ?? ""}
                disabled={disabled}
                name="note"
                placeholder="Algo breve para lembrar depois"
                type="text"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-muted-2">
              {disabled
                ? "Este registro fica bloqueado depois da finalização."
                : "Salvo no servidor e recalculado automaticamente."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                leadingIcon={<CheckCircle2 aria-hidden="true" size={15} />}
                name="status"
                size="sm"
                type="submit"
                value="completed"
              >
                {supportsValue ? "Registrar" : "Concluir"}
              </Button>
              {completed ||
              mission.state === "in_progress" ||
              mission.state === "not_applicable" ? (
                <Button
                  disabled={disabled}
                  name="status"
                  size="sm"
                  type="submit"
                  value="pending"
                  variant="secondary"
                >
                  Desmarcar
                </Button>
              ) : null}
              {!mission.required ? (
                <Button
                  disabled={disabled}
                  name="status"
                  size="sm"
                  type="submit"
                  value="not_applicable"
                  variant="ghost"
                >
                  Não se aplica
                </Button>
              ) : null}
            </div>
          </div>
        </form>

        <div className="mt-5 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <span
              className={cn(
                "h-1.5 rounded-full",
                index === 0 || completed
                  ? missionRailClassName[mission.state]
                  : "bg-white/[0.08]",
              )}
              key={index}
            />
          ))}
        </div>
      </div>
    </li>
  );
}

function MissionsSection({
  dailyLogId,
  editable,
  missions,
}: {
  dailyLogId: string | null;
  editable: boolean;
  missions: TodayMission[];
}) {
  return (
    <section className="space-y-5" aria-labelledby="missions-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
            Missões do dia
          </p>
          <h2
            className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-foreground"
            id="missions-title"
          >
            Pequenas provas de continuidade.
          </h2>
        </div>
        <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-muted sm:inline-flex">
          {missions.length} ativas
        </span>
      </div>

      {missions.length > 0 ? (
        <ul className="space-y-3">
          {missions.map((mission) => (
            <MissionRow
              dailyLogId={dailyLogId}
              editable={editable}
              key={mission.id}
              mission={mission}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/[0.03] p-8">
          <p className="max-w-xl text-sm leading-7 text-muted">
            Nenhuma missão foi publicada para este dia. Quando o ciclo tiver hábitos
            configurados, eles aparecerão aqui sem tarefas inventadas.
          </p>
        </div>
      )}
    </section>
  );
}

function ReflectionSection({ context }: { context: MemberContext }) {
  const entry = context.journalEntry;
  const dailyLog = context.activeEnrollment?.todayLog ?? null;
  const editable = Boolean(dailyLog && dailyLog.status !== "finalized");
  const hasEntry = Boolean(
    entry?.content ||
    entry?.gratitude ||
    entry?.difficulty ||
    entry?.victory ||
    entry?.tomorrow_focus ||
    entry?.mood,
  );

  return (
    <section className="rounded-[1.8rem] border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl sm:p-7">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-action-soft">
          <PenLine aria-hidden="true" size={19} />
        </span>
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-2">
            Reflexão
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            O que vale guardar de hoje?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            Um registro breve ajuda o dia a não passar despercebido.
          </p>
        </div>
      </div>

      <form action={saveJournalEntryAction} className="mt-6 space-y-3">
        <input name="dailyLogId" type="hidden" value={dailyLog?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-4">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Como foi meu dia
            </span>
            <textarea
              className="mt-3 min-h-28 w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.content ?? ""}
              disabled={!editable}
              name="content"
              placeholder="Uma frase honesta sobre o dia."
            />
          </label>
          <label className="rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-4">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Gratidão
            </span>
            <textarea
              className="mt-3 min-h-28 w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.gratitude ?? ""}
              disabled={!editable}
              name="gratitude"
              placeholder="Algo pequeno que merece ficar."
            />
          </label>
          <label className="rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-4">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Maior dificuldade
            </span>
            <textarea
              className="mt-3 min-h-24 w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.difficulty ?? ""}
              disabled={!editable}
              name="difficulty"
              placeholder="O ponto que pediu mais presença."
            />
          </label>
          <label className="rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-4">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Vitória
            </span>
            <textarea
              className="mt-3 min-h-24 w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.victory ?? ""}
              disabled={!editable}
              name="victory"
              placeholder="O que você fez apesar do dia real."
            />
          </label>
          <label className="rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-4">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Foco para amanhã
            </span>
            <textarea
              className="mt-3 min-h-24 w-full resize-none border-0 bg-transparent p-0 text-sm leading-7 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.tomorrow_focus ?? ""}
              disabled={!editable}
              name="tomorrowFocus"
              placeholder="Uma direção simples para o próximo dia."
            />
          </label>
          <label className="rounded-[1.25rem] border border-white/[0.08] bg-black/25 p-4">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Humor
            </span>
            <input
              className="mt-3 min-h-11 w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.mood ?? ""}
              disabled={!editable}
              name="mood"
              placeholder="Ex.: sereno, cansado, grato"
              type="text"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-2">
            {hasEntry
              ? "Reflexão salva no diário privado deste ciclo."
              : "Nada salvo ainda. O texto só sai do aparelho ao tocar em salvar."}
          </p>
          <Button
            disabled={!editable}
            leadingIcon={<Save aria-hidden="true" size={15} />}
            type="submit"
            variant="secondary"
          >
            Salvar reflexão
          </Button>
        </div>
      </form>

      <details className="mt-6 rounded-[1.35rem] border border-action/18 bg-action/8 p-4 open:bg-action/10">
        <summary className="cursor-pointer list-none text-sm font-semibold text-foreground outline-none transition-colors hover:text-action-soft focus-visible:text-action-soft [&::-webkit-details-marker]:hidden">
          Revisar e finalizar o dia
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div className="space-y-2 text-sm leading-6 text-muted">
            <p>
              A finalização calcula percentual, pontos, sequência e conquistas no
              servidor. Depois disso, os hábitos ficam bloqueados para evitar dupla
              pontuação.
            </p>
            <p>
              Progresso atual:{" "}
              <span className="font-semibold text-foreground">
                {context.todayProgress.completedHabits} de{" "}
                {context.todayProgress.applicableHabits}
              </span>{" "}
              hábitos aplicáveis.
            </p>
          </div>
          <form action={finalizeDailyLogAction} className="space-y-3">
            <input name="dailyLogId" type="hidden" value={dailyLog?.id ?? ""} />
            <Checkbox
              description="Entendo que o dia será fechado com as regras atuais do ciclo."
              disabled={!editable}
              label="Confirmar finalização"
              name="confirm"
              required
            />
            <Button
              className="w-full"
              disabled={!editable}
              leadingIcon={<CheckCircle2 aria-hidden="true" size={15} />}
              type="submit"
            >
              {dailyLog?.status === "finalized" ? "Dia finalizado" : "Finalizar dia"}
            </Button>
          </form>
        </div>
      </details>
    </section>
  );
}

function SecondaryContext({ context }: { context: MemberContext }) {
  const enrollment = context.activeEnrollment;

  if (!enrollment) {
    return null;
  }

  return (
    <section aria-label="Contexto da jornada" className="grid gap-3 sm:grid-cols-3">
      {[
        {
          href: null,
          icon: Flame,
          label: "Sequência",
          value: `${enrollment.streak_current} dias`,
        },
        {
          href: null,
          icon: Sparkles,
          label: "Pontos",
          value: `${enrollment.points_total}`,
        },
        { href: "/app/jornada", icon: Route, label: "Jornada", value: "Ver ciclo" },
      ].map((item) => {
        const TypedIcon = item.icon;
        const content = (
          <div className="flex min-h-24 items-center gap-4 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.03] p-4 transition-[background,border-color,transform] duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-white/14 hover:bg-white/[0.05]">
            <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-action-soft">
              <TypedIcon aria-hidden="true" size={18} />
            </span>
            <span>
              <span className="block text-xs text-muted">{item.label}</span>
              <span className="mt-1 block text-sm font-semibold text-foreground">
                {item.value}
              </span>
            </span>
          </div>
        );

        return item.href ? (
          <Link href={item.href} key={item.label}>
            {content}
          </Link>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </section>
  );
}

function NoCycleToday({ context }: { context: MemberContext }) {
  const displayName =
    context.profile.display_name || context.profile.name || context.profile.email;

  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-5 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="max-w-3xl">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
          {context.todayLabel}
        </p>
        <h1 className="mt-6 font-display text-6xl leading-[0.95] text-foreground sm:text-7xl lg:text-8xl">
          Olá, {firstName(displayName)}.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-muted sm:text-lg">
          Sua área está pronta. O próximo passo é entrar em um ciclo disponível e começar
          sem transformar o dia em cobrança.
        </p>
      </div>

      {context.availableChallenge ? (
        <div className="mt-8 rounded-[1.5rem] border border-white/[0.08] bg-black/24 p-5">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-action-soft">
            Ciclo disponível
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">
            {context.availableChallenge.name}
          </h2>
          {context.availableChallenge.description ? (
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
              {context.availableChallenge.description}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-2">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.055] px-3 py-1">
              {context.availableChallenge.duration_days} dias
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.055] px-3 py-1">
              Início pessoal no dia da inscrição
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        {context.availableChallenge ? (
          <form action={joinAvailableChallengeAction}>
            <Button type="submit">Participar do ciclo disponível</Button>
          </form>
        ) : (
          <Button disabled variant="secondary">
            Nenhum ciclo disponível
          </Button>
        )}
        <Button as="a" href="/app/jornada" variant="secondary">
          Ver jornada
        </Button>
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {["Respire", "Escolha", "Continue"].map((word, index) => (
          <div
            className="rounded-[1.35rem] border border-white/[0.08] bg-black/22 p-4"
            key={word}
          >
            <p className="font-mono text-[0.68rem] text-action-soft">0{index + 1}</p>
            <p className="mt-3 text-lg font-semibold text-foreground">{word}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyStatePanel({ context }: { context: MemberContext }) {
  if (!context.journeyError && context.journeyState === "day_available") {
    return null;
  }

  const stateContent: Record<
    MemberContext["journeyState"],
    { description: string; title: string; tone: "error" | "success" }
  > = {
    cycle_ended: {
      title: "Ciclo encerrado",
      description:
        "Este ciclo passou da duração configurada. O histórico continua preservado na jornada.",
      tone: "success",
    },
    cycle_not_started: {
      title: "Ciclo ainda não iniciado",
      description:
        "Seu início pessoal está registrado para uma data futura. Volte no dia correto para abrir a jornada.",
      tone: "success",
    },
    day_available: {
      title: "Dia aberto",
      description: "As missões de hoje estão prontas para registro.",
      tone: "success",
    },
    day_finalized: {
      title: "Dia finalizado",
      description:
        "Os registros foram fechados e a pontuação deste dia já foi consolidada.",
      tone: "success",
    },
    error: {
      title: "Não foi possível abrir o dia",
      description:
        context.journeyError ??
        "A estrutura da jornada ainda precisa ser concluída no servidor.",
      tone: "error",
    },
    no_active_cycle: {
      title: "Sem ciclo ativo",
      description: "Entre em um ciclo disponível para iniciar sua jornada.",
      tone: "success",
    },
  };
  const content = stateContent[context.journeyState];

  return (
    <StatusCard
      description={content.description}
      title={content.title}
      tone={content.tone}
    />
  );
}

function JourneyNotice({ notice }: { notice: TodayJourneyNotice | null }) {
  if (!notice) {
    return null;
  }

  return (
    <StatusCard
      description={notice.description}
      title={notice.title}
      tone={notice.tone}
    />
  );
}

export function TodayExperience({
  context,
  notice = null,
}: {
  context: MemberContext;
  notice?: TodayJourneyNotice | null;
}) {
  const displayName =
    context.profile.display_name || context.profile.name || context.profile.email;
  const enrollment = context.activeEnrollment;

  if (!enrollment) {
    return (
      <div className="space-y-5">
        <JourneyNotice notice={notice} />
        <NoCycleToday context={context} />
      </div>
    );
  }

  const dailyLogId = enrollment.todayLog?.id ?? null;
  const durationDays =
    enrollment.challenge?.duration_days ?? Math.max(1, enrollment.current_day);
  const dailyProgress = clampPercent(context.todayProgress.completionPercent);
  const completionTone = getCompletionTone(dailyProgress);
  const editable =
    context.journeyState === "day_available" &&
    Boolean(enrollment.todayLog) &&
    enrollment.todayLog?.status !== "finalized";

  return (
    <div className="space-y-12 pb-6">
      <div className="space-y-3">
        <JourneyNotice notice={notice} />
        <JourneyStatePanel context={context} />
      </div>
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] px-5 py-7 shadow-[var(--shadow-soft)] sm:px-8 sm:py-10 lg:min-h-[34rem] lg:px-10">
        <div className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.24),transparent)]" />
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-action/24 bg-action/10 px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-action-soft">
                Dia {enrollment.current_day}
              </span>
              <span className="text-sm text-muted">{context.todayLabel}</span>
            </div>
            <p className="mt-10 text-sm font-semibold text-muted">
              Olá, {firstName(displayName)}.
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-6xl leading-[0.92] text-foreground sm:text-7xl lg:text-8xl">
              Hoje eu continuo.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              {context.todayChallengeDay?.message ??
                "A disciplina de hoje não precisa fazer barulho. Ela precisa existir."}
            </p>
            <p className="mt-6 max-w-xl text-sm leading-7 text-muted-2">
              {completionTone.phrase}
            </p>
          </div>

          <div className="lg:justify-self-end">
            <TodayRhythmSignature
              currentDay={enrollment.current_day}
              durationDays={durationDays}
              progress={dailyProgress}
            />
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/22 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Estado
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {completionTone.eyebrow}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/22 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Sequência
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {enrollment.streak_current} dias
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/22 p-4">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-2">
              Pontos
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {context.todayProgress.pointsEarned} de{" "}
              {context.todayProgress.pointsPotential}
            </p>
          </div>
        </div>
      </section>

      <MissionsSection
        dailyLogId={dailyLogId}
        editable={editable}
        missions={context.todayMissions}
      />
      <ReflectionSection context={context} />
      <SecondaryContext context={context} />
    </div>
  );
}
