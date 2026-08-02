import Link from "next/link";
import { Route } from "lucide-react";

import { JourneyCalendar } from "@/components/member/journey-calendar";
import { JourneyDayDetailPanel } from "@/components/member/journey-day-detail";
import { JourneyRecurringHabits } from "@/components/member/journey-recurring-habits";
import { MemberEmptyPage } from "@/components/member/member-empty-page";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusCard } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { getJourneyDetail, getJourneyOverview } from "@/server/services/journey.service";

type JornadaPageProps = {
  searchParams: Promise<{ desafio?: string; dia?: string }>;
};

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

function buildHref({
  dayNumber,
  enrollmentId,
}: {
  dayNumber?: number;
  enrollmentId: string;
}) {
  const params = new URLSearchParams({ desafio: enrollmentId });

  if (dayNumber !== undefined) {
    params.set("dia", String(dayNumber));
  }

  return `/app/jornada?${params.toString()}`;
}

export default async function JornadaPage({ searchParams }: JornadaPageProps) {
  const params = await searchParams;
  const overview = await getJourneyOverview();

  return (
    <MemberEmptyPage
      description="Seu histórico por desafio: dias vividos, dia atual e o que ainda vem pela frente - cada desafio com seu próprio calendário, sem misturar um com o outro."
      icon={Route}
      title="Minha jornada"
    >
      {overview.enrollments.length > 0 ? (
        <JornadaContent overview={overview} searchParams={params} />
      ) : undefined}
    </MemberEmptyPage>
  );
}

async function JornadaContent({
  overview,
  searchParams,
}: {
  overview: Awaited<ReturnType<typeof getJourneyOverview>>;
  searchParams: { desafio?: string; dia?: string };
}) {
  const selectedEnrollmentId =
    overview.enrollments.find((enrollment) => enrollment.enrollmentId === searchParams.desafio)
      ?.enrollmentId ?? overview.enrollments[0]?.enrollmentId;

  if (!selectedEnrollmentId) {
    return null;
  }

  const requestedDay = searchParams.dia ? Number(searchParams.dia) : undefined;
  const validRequestedDay =
    requestedDay !== undefined && Number.isInteger(requestedDay) && requestedDay > 0
      ? requestedDay
      : undefined;
  const detail = await getJourneyDetail({
    enrollmentId: selectedEnrollmentId,
    ...(validRequestedDay !== undefined ? { selectedDayNumber: validRequestedDay } : {}),
  });

  return (
    <div className="space-y-5">
      {overview.enrollments.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist">
          {overview.enrollments.map((enrollment) => {
            const isSelected = enrollment.enrollmentId === selectedEnrollmentId;
            return (
              <Link
                aria-selected={isSelected}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                  isSelected
                    ? "border-action/40 bg-action/14 text-action-soft"
                    : "border-white/[0.08] bg-white/[0.03] text-muted hover:border-white/16 hover:text-foreground",
                )}
                href={buildHref({ enrollmentId: enrollment.enrollmentId })}
                key={enrollment.enrollmentId}
                role="tab"
              >
                {enrollment.challengeName}
              </Link>
            );
          })}
        </div>
      ) : null}

      {!detail ? (
        <StatusCard
          description="Não foi possível carregar este desafio agora."
          title="Algo deu errado"
          tone="error"
        />
      ) : (
        <>
          <Card className="space-y-4" tone="glass">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-action-soft">
                  {detail.notStarted ? "Ainda não começou" : `Dia ${detail.summary.currentDay} de ${detail.summary.durationDays}`}
                </p>
                <h2 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold text-foreground">
                  {detail.summary.challengeName}
                  {detail.summary.status === "abandoned" ? (
                    <span className="rounded-full border border-white/[0.1] bg-white/[0.06] px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">
                      Abandonado
                    </span>
                  ) : null}
                </h2>
                {detail.summary.startDate ? (
                  <p className="mt-1 text-xs text-muted-2">
                    {formatShortDate(detail.summary.startDate)}
                    {detail.summary.endDate ? ` — ${formatShortDate(detail.summary.endDate)}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-4 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-2">
                <span>{detail.summary.daysRemaining} dias restantes</span>
                <span>{detail.summary.streakCurrent}d sequência</span>
                <span>{detail.summary.pointsTotal} pts</span>
              </div>
            </div>

            {detail.notStarted ? (
              <StatusCard
                description={
                  detail.officialStartDate
                    ? `Este desafio começa oficialmente em ${formatShortDate(detail.officialStartDate)}.`
                    : "Este desafio ainda não começou oficialmente."
                }
                title="Aguardando início"
                tone="success"
              />
            ) : (
              <Progress label="Conclusão do ciclo" value={Math.round(detail.summary.completionPercent)} />
            )}
          </Card>

          {detail.calendarDays.length > 0 ? (
            <Card tone="glass">
              <JourneyCalendar
                days={detail.calendarDays}
                detailHrefForDay={(dayNumber) =>
                  buildHref({ dayNumber, enrollmentId: selectedEnrollmentId })
                }
                selectedDayNumber={detail.selectedDay?.dayNumber ?? 0}
              />
            </Card>
          ) : null}

          <JourneyRecurringHabits habits={detail.recurringHabits} />

          <JourneyDayDetailPanel day={detail.selectedDay} />
        </>
      )}
    </div>
  );
}
