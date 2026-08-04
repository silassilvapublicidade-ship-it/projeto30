"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Flag,
  FlagOff,
  Flame,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { loadMoreProfileTimelineAction, recordProfileDashboardEventAction } from "@/features/member/profile-dashboard.actions";
import {
  describeTimelineEvent,
  getTimelineFilterTypes,
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
  record: Flame,
};

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function TimelineRow({ event }: { event: TimelineEventRow }) {
  const display = describeTimelineEvent(event);
  const Icon = EVENT_ICONS[display.iconKey];

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-action-soft">
          <Icon aria-hidden="true" size={14} />
        </span>
        <span aria-hidden="true" className="mt-1 w-px flex-1 bg-white/[0.08]" />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted-2">
          {formatEventDate(event.event_at)}
          {event.challenge_name ? ` · ${event.challenge_name}` : ""}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{display.title}</p>
        {display.description ? <p className="text-xs leading-5 text-muted">{display.description}</p> : null}
      </div>
    </li>
  );
}

/**
 * Timeline de evolução (Parte 7/8/17) - filtro via navegação real (Link,
 * preserva outros parâmetros da URL), "carregar mais" via server action
 * (nunca todo o dataset de uma vez). Analytics de mudança de filtro é
 * disparado no clique do Link, sem bloquear a navegação.
 */
export function ProfileTimeline({
  activeFilter,
  challengeId,
  initialItems,
  initialHasMore,
  initialNextCursorAt,
  initialNextCursorId,
}: {
  activeFilter: TimelineFilterKey;
  challengeId: string | null;
  initialItems: TimelineEventRow[];
  initialHasMore: boolean;
  initialNextCursorAt: string | null;
  initialNextCursorId: string | null;
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
          <ul className="pl-1">
            {items.map((event) => (
              <TimelineRow event={event} key={`${event.event_type}:${event.event_source_id}`} />
            ))}
          </ul>

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
