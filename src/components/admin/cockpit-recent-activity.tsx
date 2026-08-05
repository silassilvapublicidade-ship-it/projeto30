import Link from "next/link";

import { describeActivityCategory, describeAuditAction } from "@/features/admin/admin-activity.core";
import { formatProjectDateTime } from "@/lib/format-date";
import type { RecentActivityItem } from "@/server/services/admin-operational-overview.service";

function describeItem(item: RecentActivityItem) {
  if (item.category === "admin") {
    return describeAuditAction(item.label);
  }
  return item.label;
}

export function CockpitRecentActivity({ items }: { items: RecentActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-muted">
        Não há atividade registrada neste período.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/[0.06] rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03]">
      {items.map((item, index) => {
        const content = (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{describeItem(item)}</p>
              <p className="mt-0.5 text-xs text-muted-2">
                {describeActivityCategory(item.category)}
                {item.detail ? ` · ${item.detail}` : ""}
                {item.actor_name ? ` · ${item.actor_name}` : ""}
              </p>
            </div>
            <span className="shrink-0 font-mono text-[0.68rem] text-muted-2">{formatProjectDateTime(item.occurred_at)}</span>
          </div>
        );

        return (
          <li key={`${item.category}-${item.occurred_at}-${index}`}>
            {item.link ? (
              <Link className="block transition-colors hover:bg-white/[0.04] focus-visible:outline-action-soft" href={item.link}>
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
