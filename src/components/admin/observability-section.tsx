import type { ReactNode } from "react";

export function ObservabilitySection({
  title,
  badge,
  cta,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: ReactNode;
  cta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] open:bg-white/[0.035]"
      open={defaultOpen}
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold text-foreground">{title}</span>
          {badge}
        </span>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-action transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
        {children}
        {cta}
      </div>
    </details>
  );
}
