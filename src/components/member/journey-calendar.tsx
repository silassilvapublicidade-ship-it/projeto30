import Link from "next/link";
import { Check, Lock, Minus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { JourneyCalendarDay, JourneyDayState } from "@/server/services/journey.service";

// partial_kept/partial_lost share the same visual family (both are
// finalizado) - the distinction is in the label, not the color, so the
// calendar grid never has to invent a 5th color for a 7-cell-wide row. What
// must never happen again: a finalized day (any percent) looking identical
// to a day that was never opened at all - that's the completed/partial_*
// family vs not_finalized, not a 100%-vs-everything-else split.
const stateStyle: Record<JourneyDayState, string> = {
  completed: "border-action/32 bg-action/14 text-action-soft",
  future: "border-white/[0.06] bg-black/15 text-muted-2",
  not_finalized: "border-white/10 bg-white/[0.03] text-muted",
  partial_kept: "border-warning/28 bg-warning/10 text-warning",
  partial_lost: "border-warning/28 bg-warning/10 text-warning",
  today: "border-action bg-action text-background shadow-[0_0_0_4px_rgba(255,106,0,0.16)]",
};

// The word "finalizado" is always present for any day that was actually
// closed, regardless of percent - never just "parcial" on its own, which
// previously read as ambiguous-to-not-done at a glance.
const stateLabel: Record<JourneyDayState, string> = {
  completed: "finalizado, completo",
  future: "bloqueado, ainda não chegou",
  not_finalized: "não finalizado",
  partial_kept: "finalizado, parcial, sequência mantida",
  partial_lost: "finalizado, parcial, sequência não mantida",
  today: "hoje",
};

function DayIcon({ state }: { state: JourneyDayState }) {
  const props = { "aria-hidden": true, size: 10 };

  if (state === "completed") {
    return <Check {...props} />;
  }

  if (state === "partial_kept" || state === "partial_lost") {
    return <Minus {...props} />;
  }

  if (state === "not_finalized") {
    return <X {...props} />;
  }

  if (state === "future") {
    return <Lock {...props} />;
  }

  return null;
}

export function JourneyCalendar({
  days,
  detailHrefForDay,
  selectedDayNumber,
}: {
  days: JourneyCalendarDay[];
  detailHrefForDay: (dayNumber: number) => string;
  selectedDayNumber: number;
}) {
  return (
    <div className="space-y-3">
      <div
        aria-label="Calendário do desafio"
        className="grid grid-cols-7 gap-1.5 sm:grid-cols-10"
      >
        {days.map((day) => {
          const isSelected = day.dayNumber === selectedDayNumber;
          const isClickable = day.state !== "future";
          const label = `Dia ${day.dayNumber}, ${stateLabel[day.state]}`;
          const cellClassName = cn(
            "relative flex aspect-square min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border font-mono text-[0.68rem] font-semibold tabular-nums transition-[transform,border-color] duration-[var(--motion-base)]",
            stateStyle[day.state],
            isSelected && day.state !== "today" && "ring-2 ring-white/40",
            isClickable && "hover:scale-105",
          );

          if (!isClickable) {
            return (
              <span aria-label={label} className={cellClassName} key={day.dayNumber}>
                {day.dayNumber}
                <DayIcon state={day.state} />
              </span>
            );
          }

          return (
            <Link
              aria-current={isSelected ? "date" : undefined}
              aria-label={label}
              className={cellClassName}
              href={detailHrefForDay(day.dayNumber)}
              key={day.dayNumber}
            >
              {day.dayNumber}
              <DayIcon state={day.state} />
            </Link>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted-2">
        <li className="flex items-center gap-1.5">
          <Check aria-hidden="true" size={11} /> Finalizado, completo
        </li>
        <li className="flex items-center gap-1.5">
          <Minus aria-hidden="true" size={11} /> Finalizado, parcial
        </li>
        <li className="flex items-center gap-1.5">
          <X aria-hidden="true" size={11} /> Não finalizado
        </li>
        <li className="flex items-center gap-1.5">
          <Lock aria-hidden="true" size={11} /> Bloqueado
        </li>
        <li className="flex items-center gap-1.5 text-action-soft">Hoje = destacado</li>
      </ul>
    </div>
  );
}
