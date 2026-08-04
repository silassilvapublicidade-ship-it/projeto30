import Link from "next/link";
import { CalendarClock, PauseCircle, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import { TodayInteractiveSection } from "@/components/member/today-interactive-section";
import { resolveDailyChallengeMessage } from "@/features/journey/progress-motivation.core";
import type {
  EnrollmentDayContext,
  MemberContext,
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
    cycle_paused: {
      title: "Desafio pausado",
      description:
        "Este desafio está pausado no momento. Seu progresso, pontos e sequência estão preservados - a contagem de dias retoma de onde parou assim que ele voltar.",
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

function PausedCard({ enrollmentContext }: { enrollmentContext: EnrollmentDayContext }) {
  const { enrollment } = enrollmentContext;

  return (
    <section
      aria-label={enrollment.challenge?.name ?? "Desafio"}
      className="space-y-3 rounded-[1.75rem] border border-white/[0.06] bg-white/[0.015] p-3 sm:p-4"
    >
      <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-action-soft">
            <PauseCircle aria-hidden="true" size={15} />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {enrollment.challenge?.name ?? "Desafio"}
            </h2>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-action-soft">
              Pausado
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          Suas missões, diário e pontuação continuam guardados. Eles voltam a ficar disponíveis
          assim que o desafio for retomado - nenhum dia é perdido durante a pausa.
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

  if (enrollmentContext.journeyState === "cycle_paused") {
    return <PausedCard enrollmentContext={enrollmentContext} />;
  }

  const dailyLogId = enrollment.todayLog?.id ?? null;
  const durationDays =
    enrollment.challenge?.duration_days ?? Math.max(1, enrollment.current_day);
  const dailyProgress = clampPercent(enrollmentContext.todayProgress.completionPercent);

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
          {resolveDailyChallengeMessage(enrollmentContext.todayChallengeDay?.message)}
        </p>
      </div>

      <TodayInteractiveSection
        challengeDayMessage={enrollmentContext.todayChallengeDay?.message ?? null}
        dailyLogId={dailyLogId}
        dayNumber={enrollment.current_day}
        durationDays={durationDays}
        enrollmentId={enrollment.id}
        initialCompletionPercent={enrollment.todayLog?.completion_percent ?? 0}
        initialFinalized={enrollment.todayLog?.status === "finalized"}
        initialFinalizedAt={enrollment.todayLog?.finalized_at ?? null}
        initialPointsEarned={enrollment.todayLog?.points_earned ?? 0}
        initialStreakBest={enrollment.streak_best}
        initialStreakCurrent={enrollment.streak_current}
        journalEntry={enrollmentContext.journalEntry}
        missions={enrollmentContext.todayMissions}
        pointsPotential={enrollmentContext.todayProgress.pointsPotential}
        streakMinimumCompletion={enrollmentContext.todayProgress.streakMinimumCompletion}
        yesterdayCompletionPercent={enrollmentContext.todayProgress.yesterdayCompletionPercent}
      />
    </section>
  );
}
