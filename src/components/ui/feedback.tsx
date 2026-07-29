import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { AlertTriangle, Check, Inbox, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusCardProps = ComponentPropsWithoutRef<"div"> & {
  tone: "success" | "error";
  title: string;
  description: string;
};

const statusTone = {
  success: {
    icon: Check,
    className: "border-success/22 bg-success-wash text-success",
  },
  error: {
    icon: AlertTriangle,
    className: "border-danger/22 bg-danger-wash text-danger",
  },
};

export function StatusCard({
  className,
  description,
  title,
  tone,
  ...props
}: StatusCardProps) {
  const Icon = statusTone[tone].icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 shadow-[var(--shadow-hairline)]",
        statusTone[tone].className,
        className,
      )}
      role={tone === "error" ? "alert" : "status"}
      {...props}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-current/10">
        <Icon aria-hidden="true" size={12} />
      </span>
      <span className="min-w-0 leading-4">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted"> — {description}</span>
      </span>
    </div>
  );
}

type EmptyStateProps = ComponentPropsWithoutRef<"div"> & {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({
  action,
  className,
  description,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-white/12 bg-white/[0.035] p-8 text-center shadow-[var(--shadow-hairline)]",
        className,
      )}
      {...props}
    >
      <span className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-muted">
        <Inbox aria-hidden="true" size={19} />
      </span>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}
      role="status"
      {...props}
    >
      <Loader2
        aria-hidden="true"
        className="animate-spin text-action"
        size={16}
        strokeWidth={2.2}
      />
      Carregando
    </span>
  );
}

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] bg-white/[0.07] shadow-[var(--shadow-hairline)] before:absolute before:inset-y-0 before:w-1/2 before:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.09),transparent)] before:[animation:p30-sheen_1.8s_var(--ease-premium)_infinite]",
        className,
      )}
      {...props}
    />
  );
}
