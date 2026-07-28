import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type RhythmRailState = "done" | "today" | "rest" | "next";

export type RhythmRailDay = {
  day: number;
  state: RhythmRailState;
};

type RhythmRailProps = ComponentPropsWithoutRef<"div"> & {
  days?: RhythmRailDay[];
  label?: string;
  compact?: boolean;
};

export const defaultRhythmRailDays: RhythmRailDay[] = Array.from(
  { length: 30 },
  (_, index) => {
    const day = index + 1;

    return {
      day,
      state: day < 13 ? "done" : day === 13 ? "today" : day % 7 === 0 ? "rest" : "next",
    };
  },
);

const stateClassName: Record<RhythmRailState, string> = {
  done: "border-white/12 bg-white/[0.10] text-foreground",
  today:
    "border-action bg-action text-background shadow-[0_0_0_5px_rgba(255,106,0,0.14)]",
  rest: "border-action/22 bg-action/10 text-action-soft",
  next: "border-white/[0.08] bg-black/20 text-muted-2",
};

export function RhythmRail({
  className,
  compact = false,
  days = defaultRhythmRailDays,
  label = "Trinta dias do ciclo",
  ...props
}: RhythmRailProps) {
  return (
    <div
      className={cn(
        "w-full max-w-full min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-white/[0.10] bg-white/[0.055] shadow-[var(--shadow-soft)] backdrop-blur-xl",
        compact ? "p-3" : "p-4",
        className,
      )}
      {...props}
    >
      <div
        aria-label={label}
        className={cn("grid min-w-0 grid-cols-5", compact ? "gap-1.5" : "gap-2")}
      >
        {days.map((item) => (
          <span
            aria-label={`Dia ${item.day}`}
            className={cn(
              "flex min-w-0 aspect-square items-center justify-center rounded-full border font-semibold tabular-nums transition-transform duration-[var(--motion-base)] ease-[var(--ease-premium)] hover:scale-105",
              compact ? "text-[0.65rem]" : "text-xs",
              stateClassName[item.state],
            )}
            key={item.day}
          >
            {item.day}
          </span>
        ))}
      </div>
    </div>
  );
}
