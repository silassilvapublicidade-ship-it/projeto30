import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type ProgressProps = ComponentPropsWithoutRef<"div"> & {
  value: number;
  label?: string;
};

export function Progress({ className, label, value, ...props }: ProgressProps) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("space-y-2", className)} {...props}>
      {label ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>{label}</span>
          <span className="font-mono text-foreground">{safeValue}%</span>
        </div>
      ) : null}
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        className="h-2 overflow-hidden rounded-[var(--radius-pill)] bg-white/[0.07] shadow-[var(--shadow-hairline)]"
        role="progressbar"
      >
        <div
          className="h-full rounded-[var(--radius-pill)] bg-[linear-gradient(90deg,var(--p30-orange),var(--p30-orange-soft))] transition-[width] duration-[var(--motion-slow)] ease-[var(--ease-premium)]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
