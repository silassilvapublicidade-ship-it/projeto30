import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Droplets,
  Dumbbell,
  Flame,
  Heart,
  MessageSquare,
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
import { cn } from "@/lib/utils";
import type {
  EnrollmentDayContext,
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function getCompletionEyebrow(progress: number) {
  if (progress >= 100) {
    return "Dia completo";
  }

  if (progress > 0) {
    return "Dia em movimento";
  }

  return "Dia aberto";
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
  const props = { "aria-hidden": true, size: 16 };

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
  completed: "border-action/38 bg-action/16 text-action-soft",
  in_progress: "border-action/32 bg-action/12 text-action-soft",
  not_applicable: "border-white/10 bg-white/[0.05] text-muted",
  pending: "border-white/[0.10] bg-white/[0.045] text-muted",
  skipped: "border-warning/28 bg-warning/10 text-warning",
};

function TodayProgressBar({
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

  return (
    <div className="flex items-center gap-3">
      <p className="font-display text-2xl leading-none text-foreground">
        {safeProgress}
        <span className="text-xs font-normal text-muted-2">%</span>
      </p>
      <div className="min-w-0 flex-1">
        <div
          aria-label="Progresso do dia"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={safeProgress}
          className="h-2 w-full overflow-visible rounded-full bg-white/10"
          role="progressbar"
        >
          <div
            className="relative h-full rounded-full bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-amber))] transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-premium)]"
            style={{ width: `${safeProgress}%` }}
          >
            {safeProgress > 0 ? (
              <span className="absolute right-0 top-1/2 size-2.5 -translate-y-1/2 translate-x-1/3 rounded-full bg-[var(--p30-amber-soft)] shadow-[0_0_9px_rgba(255,203,115,0.75)] transition-[right] duration-[var(--motion-slow)] ease-[var(--ease-premium)]" />
            ) : null}
          </div>
        </div>
        <p className="mt-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-2">
          Dia {rhythmIndex} de {durationDays}
        </p>
      </div>
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
  const disabled = !dailyLogId || !editable;
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
          completed && "border-action/28 bg-action/[0.05]",
        )}
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full border",
              missionStateClassName[mission.state],
            )}
          >
            <MissionGlyph mission={mission} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-semibold leading-5 text-foreground">
                {mission.title}
              </h3>
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
                  mission.state === "completed"
                    ? "text-action-soft"
                    : mission.state === "not_applicable"
                      ? "text-muted"
                      : "text-action-soft",
                )}
              >
                {mission.statusLabel}
              </span>{" "}
              · {mission.targetLabel}
            </p>
            {isPeriodHabit && mission.periodProgress ? (
              <p className="mt-0.5 text-xs leading-4 text-muted-2">
                {mission.periodProgress.completed}
                {mission.periodProgress.target !== null
                  ? ` de ${mission.periodProgress.target}`
                  : ""}{" "}
                {mission.frequencyType === "weekly" ? "concluídos esta semana" : "concluídos este mês"}
                {" "}· não conta como obrigação de hoje
              </p>
            ) : null}
          </div>
        </div>

        <form
          action={updateHabitLogAction}
          className="mt-2 rounded-md border border-white/[0.05] bg-black/15 p-1.5"
        >
          <input name="dailyLogId" type="hidden" value={dailyLogId ?? ""} />
          <input name="habitId" type="hidden" value={mission.habitId} />
          <details className="group" open={Boolean(mission.note)}>
            <summary className="flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-muted-2 transition-colors hover:text-foreground">
              <MessageSquare aria-hidden="true" size={12} />
              {mission.note ? "Comentário adicionado · editar" : "Adicionar comentário"}
            </summary>
            <textarea
              aria-label="Comentário opcional"
              className="mt-1.5 min-h-14 w-full resize-none rounded-[10px] border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 text-sm leading-5 text-foreground outline-none transition-[border-color,background,box-shadow] duration-[var(--motion-base)] placeholder:text-muted-2 focus:border-action/60 focus:shadow-[0_0_0_3px_rgba(255,106,0,0.1)] disabled:opacity-45"
              defaultValue={mission.note ?? ""}
              disabled={disabled}
              maxLength={1200}
              name="note"
              placeholder="Ex.: fiz 30 minutos de caminhada"
            />
          </details>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button
              disabled={disabled}
              leadingIcon={<CheckCircle2 aria-hidden="true" size={12} />}
              name="status"
              size="xs"
              type="submit"
              value="completed"
            >
              Marcar como realizado
            </Button>
            {completed ||
            mission.state === "in_progress" ||
            mission.state === "not_applicable" ? (
              <Button
                disabled={disabled}
                name="status"
                size="xs"
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
                size="xs"
                type="submit"
                value="not_applicable"
                variant="ghost"
              >
                Não se aplica
              </Button>
            ) : null}
          </div>
        </form>
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
    <section className="space-y-2.5" aria-labelledby="missions-title">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft"
          id="missions-title"
        >
          Missões do dia
        </h2>
        <span className="text-xs text-muted">{missions.length} ativas</span>
      </div>

      {missions.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
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
        <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.03] p-6">
          <p className="max-w-xl text-sm leading-6 text-muted">
            Nenhuma missão foi publicada para este dia. Quando o ciclo tiver hábitos
            configurados, eles aparecerão aqui sem tarefas inventadas.
          </p>
        </div>
      )}
    </section>
  );
}

function FinalizeSection({ enrollmentContext }: { enrollmentContext: EnrollmentDayContext }) {
  const dailyLog = enrollmentContext.enrollment.todayLog ?? null;
  const editable = Boolean(dailyLog && dailyLog.status !== "finalized");

  return (
    <section className="rounded-xl border border-action/16 bg-action/[0.045] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-muted">
          <span className="font-semibold text-foreground">
            {enrollmentContext.todayProgress.completedHabits} de{" "}
            {enrollmentContext.todayProgress.applicableHabits}
          </span>{" "}
          hábitos aplicáveis. A finalização calcula pontos, sequência e conquistas no
          servidor e bloqueia edições depois.
        </p>
        <form action={finalizeDailyLogAction} className="flex flex-col gap-2 sm:w-64 sm:shrink-0">
          <input name="dailyLogId" type="hidden" value={dailyLog?.id ?? ""} />
          <Checkbox
            description="Entendo que o dia será fechado com as regras atuais do ciclo."
            disabled={!editable}
            label="Confirmar finalização"
            name="confirm"
            required
          />
          <Button
            disabled={!editable}
            leadingIcon={<CheckCircle2 aria-hidden="true" size={14} />}
            size="sm"
            type="submit"
          >
            {dailyLog?.status === "finalized" ? "Dia finalizado" : "Finalizar dia"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function ReflectionSection({ enrollmentContext }: { enrollmentContext: EnrollmentDayContext }) {
  const entry = enrollmentContext.journalEntry;
  const dailyLog = enrollmentContext.enrollment.todayLog ?? null;
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
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-action-soft">
          <PenLine aria-hidden="true" size={15} />
        </span>
        <div>
          <h2 className="font-display text-base text-foreground">
            Seu diário de hoje.
          </h2>
          <p className="text-xs leading-4 text-muted-2">
            Sem filtro. Ninguém mais lê isso além de você.
          </p>
        </div>
      </div>

      <form action={saveJournalEntryAction} className="mt-4 space-y-2.5">
        <input name="dailyLogId" type="hidden" value={dailyLog?.id ?? ""} />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">
              Como foi o meu dia?
            </span>
            <textarea
              className="mt-2 min-h-16 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.content ?? ""}
              disabled={!editable}
              name="content"
              placeholder="Escreva como se ninguém fosse ler."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">
              Pelo que sou grato hoje?
            </span>
            <textarea
              className="mt-2 min-h-16 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.gratitude ?? ""}
              disabled={!editable}
              name="gratitude"
              placeholder="Algo pequeno que merece ficar."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">
              O que pesou hoje?
            </span>
            <textarea
              className="mt-2 min-h-14 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.difficulty ?? ""}
              disabled={!editable}
              name="difficulty"
              placeholder="O ponto que pediu mais presença."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">
              O que eu venci hoje?
            </span>
            <textarea
              className="mt-2 min-h-14 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.victory ?? ""}
              disabled={!editable}
              name="victory"
              placeholder="Mesmo pequeno, conta."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">
              Amanhã, eu quero...
            </span>
            <textarea
              className="mt-2 min-h-14 w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-2 disabled:opacity-55"
              defaultValue={entry?.tomorrow_focus ?? ""}
              disabled={!editable}
              name="tomorrowFocus"
              placeholder="Uma direção simples para o próximo dia."
            />
          </label>
          <label className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
            <span className="font-display text-sm italic text-foreground/85">
              Como estou me sentindo?
            </span>
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

function SecondaryContext() {
  return (
    <div className="flex justify-center">
      <Link
        className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-muted transition-[background,border-color,color] duration-[var(--motion-base)] hover:border-white/14 hover:bg-white/[0.05] hover:text-foreground"
        href="/app/jornada"
      >
        <Route aria-hidden="true" size={14} />
        Ver jornada completa
      </Link>
    </div>
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
          Sua área está pronta. O próximo passo é escolher um desafio no catálogo e começar
          sem transformar o dia em cobrança.
        </p>
      </div>

      {context.availableChallenge ? (
        <div className="mt-8 rounded-[1.5rem] border border-white/[0.08] bg-black/24 p-5">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-action-soft">
            Um desafio disponível agora
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
        <Button as="a" href="/app/desafios">
          {context.availableChallenge ? "Ver desafios disponíveis" : "Explorar desafios"}
        </Button>
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

function JourneyStatePanel({ enrollmentContext }: { enrollmentContext: EnrollmentDayContext }) {
  if (!enrollmentContext.journeyError && enrollmentContext.journeyState === "day_available") {
    return null;
  }

  const stateContent: Record<
    EnrollmentDayContext["journeyState"],
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
        "Este desafio ainda não chegou na sua data oficial de início. Volte nesse dia para abrir a jornada.",
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
        enrollmentContext.journeyError ??
        "A estrutura da jornada ainda precisa ser concluída no servidor.",
      tone: "error",
    },
    no_active_cycle: {
      title: "Sem ciclo ativo",
      description: "Entre em um ciclo disponível para iniciar sua jornada.",
      tone: "success",
    },
  };
  const content = stateContent[enrollmentContext.journeyState];

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

  if (context.enrollments.length === 0) {
    return (
      <div className="space-y-5">
        <JourneyNotice notice={notice} />
        <NoCycleToday context={context} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-action-soft">
          {context.todayLabel}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
          Olá, {firstName(displayName)}. Hoje eu continuo.
        </h1>
        {context.enrollments.length > 1 ? (
          <p className="mt-1 text-sm text-muted">
            Você está com {context.enrollments.length} desafios ativos agora. Cada um mantém seu
            próprio progresso, pontos e sequência.
          </p>
        ) : null}
      </div>

      <JourneyNotice notice={notice} />

      <div className="space-y-5">
        {context.enrollments.map((enrollmentContext) => (
          <EnrollmentSection
            enrollmentContext={enrollmentContext}
            key={enrollmentContext.enrollment.id}
            todayLabel={context.todayLabel}
          />
        ))}
      </div>

      <SecondaryContext />
    </div>
  );
}

function NotStartedCard({ enrollmentContext }: { enrollmentContext: EnrollmentDayContext }) {
  const { enrollment } = enrollmentContext;
  const startDate = enrollment.challenge?.start_date ?? null;

  return (
    <section
      aria-label={enrollment.challenge?.name ?? "Desafio"}
      className="space-y-3 rounded-[1.75rem] border border-white/[0.06] bg-white/[0.015] p-3 sm:p-4"
    >
      <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-action-soft">
            <CalendarClock aria-hidden="true" size={15} />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {enrollment.challenge?.name ?? "Desafio"}
            </h2>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-action-soft">
              {startDate ? `Começa em ${formatShortDate(startDate)}` : "Ainda não começou"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          Sua inscrição está garantida. As missões, o diário e a finalização deste desafio são
          liberados assim que a data oficial de início chegar.
        </p>
      </div>
    </section>
  );
}

function EnrollmentSection({
  enrollmentContext,
  todayLabel,
}: {
  enrollmentContext: EnrollmentDayContext;
  todayLabel: string;
}) {
  const { enrollment } = enrollmentContext;

  if (enrollmentContext.journeyState === "cycle_not_started") {
    return <NotStartedCard enrollmentContext={enrollmentContext} />;
  }

  const dailyLogId = enrollment.todayLog?.id ?? null;
  const durationDays =
    enrollment.challenge?.duration_days ?? Math.max(1, enrollment.current_day);
  const dailyProgress = clampPercent(enrollmentContext.todayProgress.completionPercent);
  const editable =
    enrollmentContext.journeyState === "day_available" &&
    Boolean(enrollment.todayLog) &&
    enrollment.todayLog?.status !== "finalized";

  return (
    <section
      aria-label={enrollment.challenge?.name ?? "Desafio"}
      className="space-y-3 rounded-[1.75rem] border border-white/[0.06] bg-white/[0.015] p-3 sm:p-4"
    >
      <JourneyStatePanel enrollmentContext={enrollmentContext} />

      <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-action/24 bg-action/10 px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-action-soft">
              Dia {enrollment.current_day}
            </span>
            <span className="text-xs text-muted">{todayLabel}</span>
          </div>
          <span className="text-xs text-muted-2">{getCompletionEyebrow(dailyProgress)}</span>
        </div>

        <h2 className="mt-2 text-xl font-semibold leading-tight text-foreground sm:text-2xl">
          {enrollment.challenge?.name ?? "Desafio"}
        </h2>
        <p className="mt-1 truncate text-sm text-muted">
          {enrollmentContext.todayChallengeDay?.message ??
            "A disciplina de hoje não precisa fazer barulho. Ela precisa existir."}
        </p>

        <div className="mt-3">
          <TodayProgressBar
            currentDay={enrollment.current_day}
            durationDays={durationDays}
            progress={dailyProgress}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-2">
          <span>
            {enrollmentContext.todayProgress.completedHabits}/
            {enrollmentContext.todayProgress.applicableHabits} hábitos
          </span>
          <span>
            {enrollmentContext.todayProgress.pointsEarned}/
            {enrollmentContext.todayProgress.pointsPotential} pts
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame aria-hidden="true" className="text-action-soft" size={12} />
            {enrollment.streak_current}d sequência
          </span>
        </div>
      </div>

      <MissionsSection
        dailyLogId={dailyLogId}
        editable={editable}
        missions={enrollmentContext.todayMissions}
      />
      <ReflectionSection enrollmentContext={enrollmentContext} />
      <FinalizeSection enrollmentContext={enrollmentContext} />
    </section>
  );
}
