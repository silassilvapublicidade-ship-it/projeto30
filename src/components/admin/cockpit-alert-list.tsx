import Link from "next/link";
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

import type { HealthAlert } from "@/features/observability/health-alerts.core";
import { cn } from "@/lib/utils";

const toneMeta = {
  critical: { icon: AlertOctagon, className: "border-danger/25 bg-danger-wash text-danger" },
  warning: { icon: AlertTriangle, className: "border-warning/25 bg-warning-wash text-warning" },
  info: { icon: Info, className: "border-white/[0.08] bg-white/[0.035] text-muted" },
} as const;

export function CockpitAlertList({ alerts }: { alerts: HealthAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-success/22 bg-success-wash p-4 text-sm text-success sm:p-5">
        Tudo funcionando normalmente. Nenhum ponto exige atenção agora.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const meta = toneMeta[alert.tone];
        const Icon = meta.icon;

        return (
          <li
            className={cn(
              "flex flex-col gap-2 rounded-[var(--radius-card)] border p-3 sm:flex-row sm:items-start sm:justify-between sm:p-4",
              meta.className,
            )}
            key={alert.title}
          >
            <div className="flex gap-2.5">
              <Icon aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted sm:text-sm">{alert.description}</p>
              </div>
            </div>
            {alert.href ? (
              <Link
                className="inline-flex shrink-0 items-center rounded-[var(--radius-pill)] border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-white/[0.08] focus-visible:outline-action-soft sm:ml-3"
                href={alert.href}
              >
                Ver detalhes
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
