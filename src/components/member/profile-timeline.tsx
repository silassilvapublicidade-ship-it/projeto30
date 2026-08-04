"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  ChevronDown,
  Flag,
  FlagOff,
  Flame,
  Milestone,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ProgressShareButton } from "@/components/member/progress-share-button";
import { loadMoreProfileTimelineAction, recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";
import {
  describeTimelineEvent,
  getTimelineFilterTypes,
  groupTimelineEventsByDate,
  TIMELINE_FILTERS,
  type TimelineEventIconKey,
  type TimelineEventRow,
  type TimelineFilterKey,
} from "@/features/profile/profile-evolution.core";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<TimelineEventIconKey, LucideIcon> = {
  achievement: Trophy,
  challenge_abandon: FlagOff,
  challenge_complete: Flag,
  challenge_start: Flag,
  day: CalendarCheck,
  halfway: Milestone,
  record: Flame,
};

function TimelineRow({ event }: { event: TimelineEventRow }) {
  const display = describeTimelineEvent(event);
  const Icon = EVENT_ICONS[display.iconKey];
  const [expanded, setExpanded] = useState(false);
  const hasMoreHabits = Boolean(event.habit_titles && event.habit_titles.length > 3);

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-action-soft">
          <Icon aria-hidden="true" size={14} />
        </span>
        <span aria-hidden="true" className="mt-1 w-px flex-1 bg-white/[0.08]" />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        {event.challenge_name ? (
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">{event.challenge_name}</p>
        ) : null}
        <p className="mt-0.5 text-sm font-semibold text-foreground">{display.title}</p>
        {display.description ? <p className="text-xs leading-5 text-muted">{display.description}</p> : null}

        {hasMoreHabits ? (
          <button
            aria-expanded={expanded}
            className="mt-1.5 inline-flex items-center gap-1 text-[0.68rem] font-semibold text-action-soft transition-colors hover:text-foreground"
            onClick={() => {
              if (!expanded) {
                void recordProfileDashboardEventAction("timeline_event_expanded");
              }
              setExpanded((current) => !current);
            }}
            type="button"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn("transition-transform", expanded ? "rotate-180" : undefined)}
              size={12}
            />
            {expanded ? "Ver menos" : "Ver todos os hábitos"}
          </button>
        ) : null}

        {expanded && event.habit_titles ? (
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs leading-5 text-muted">
            {event.habit_titles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        ) : null}

        {event.event_type === "day_finalized" ? (
          <div className="mt-2">
            <ProgressShareButton dailyLogId={event.event_source_id} kind="day_completed" label={display.title} />
          </div>
        ) : null}
        {event.event_type === "streak_record" ? (
          <div className="mt-2">
            <ProgressShareButton dailyLogId={event.event_source_id} kind="streak_record" label={display.title} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function TimelineDateGroup({ dateLabel, events }: { dateLabel: string; events: TimelineEventRow[] }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-foreground">
        {dateLabel}
      </p>
      <ul className="pl-1">
        {events.map((event) => (
          <TimelineRow event={event} key={`${event.event_type}:${event.event_source_id}`} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Timeline de evolução (Parte 7/8/17 da rodada anterior; Parte C desta
 * rodada - agrupamento por data, resumo do dia com hábitos, novos tipos de
 * evento). Filtro via navegação real (Link, preserva outros parâmetros da
 * URL), "carregar mais" via server action (nunca todo o dataset de uma
 * vez). O agrupamento por data é recalculado a cada render a partir dos
 * itens já carregados - puro, nunca uma segunda busca.
 */
export function ProfileTimeline({
  activeFilter,
  challengeId,
  initialItems,
  initialHasMore,
  initialNextCursorAt,
  initialNextCursorId,
  today,
  yesterday,
}: {
  activeFilter: TimelineFilterKey;
  challengeId: string | null;
  initialItems: TimelineEventRow[];
  initialHasMore: boolean;
  initialNextCursorAt: string | null;
  initialNextCursorId: string | null;
  today: string;
  yesterday: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursorAt, setCursorAt] = useState(initialNextCursorAt);
  const [cursorId, setCursorId] = useState(initialNextCursorId);
  const [isLoadingMore, startLoadMore] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  function handleLoadMore() {
    if (!cursorAt || !cursorId) return;
    setLoadError(null);

    startLoadMore(async () => {
      try {
        const page = await loadMoreProfileTimelineAction({
          ...(challengeId ? { challengeId } : {}),
          cursorAt,
          cursorId,
          ...(getTimelineFilterTypes(activeFilter) ? { types: getTimelineFilterTypes(activeFilter)! } : {}),
        });
        setItems((current) => [...current, ...page.items]);
        setHasMore(page.hasMore);
        setCursorAt(page.nextCursorAt);
        setCursorId(page.nextCursorId);
      } catch {
        setLoadError("Não foi possível carregar mais eventos agora.");
      }
    });
  }

  function buildFilterHref(filterKey: TimelineFilterKey) {
    const params = new URLSearchParams();
    if (filterKey !== "all") params.set("timeline", filterKey);
    if (challengeId) params.set("desafio", challengeId);
    const query = params.toString();
    return `/app/dashboard${query ? `?${query}` : ""}#timeline`;
  }

  const groups = groupTimelineEventsByDate(items, today, yesterday);

  return (
    <section aria-labelledby="profile-timeline-heading" className="space-y-3" id="timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-action-soft" id="profile-timeline-heading">
          Linha do tempo
        </h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar linha do tempo">
          {TIMELINE_FILTERS.map((filter) => (
            <Link
              className={cn(
                "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
                activeFilter === filter.key
                  ? "border-action/32 bg-action/14 text-action-soft"
                  : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
              )}
              href={buildFilterHref(filter.key)}
              key={filter.key}
              onClick={() => {
                void recordProfileDashboardEventAction("profile_timeline_filter_changed");
              }}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState description="Seus próximos registros aparecerão aqui." title="Sem eventos ainda" />
      ) : (
        <>
          <div className="space-y-5">
            {groups.map((group) => (
              <TimelineDateGroup dateLabel={group.dateLabel} events={group.events} key={group.dateKey} />
            ))}
          </div>

          {loadError ? <p className="text-xs text-danger">{loadError}</p> : null}

          {hasMore ? (
            <Button loading={isLoadingMore} onClick={handleLoadMore} size="sm" type="button" variant="secondary">
              {isLoadingMore ? "Carregando..." : "Carregar mais"}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
