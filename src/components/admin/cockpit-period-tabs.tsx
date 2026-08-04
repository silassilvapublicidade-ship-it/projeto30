import Link from "next/link";

import { COCKPIT_PERIODS, COCKPIT_PERIOD_LABELS, type CockpitPeriod } from "@/features/admin/admin-activity.core";
import { cn } from "@/lib/utils";

export function CockpitPeriodTabs({ current }: { current: CockpitPeriod }) {
  return (
    <nav aria-label="Filtro de período" className="inline-flex gap-1 rounded-[var(--radius-pill)] border border-white/[0.08] bg-white/[0.03] p-1">
      {COCKPIT_PERIODS.map((period) => (
        <Link
          aria-current={period === current ? "page" : undefined}
          className={cn(
            "rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-action-soft",
            period === current
              ? "bg-action/15 text-action-soft"
              : "text-muted hover:bg-white/[0.06] hover:text-foreground",
          )}
          href={period === "today" ? "/admin" : `/admin?period=${period}`}
          key={period}
        >
          {COCKPIT_PERIOD_LABELS[period]}
        </Link>
      ))}
    </nav>
  );
}
