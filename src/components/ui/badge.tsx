import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: "accent" | "neutral" | "success" | "warning" | "danger";
};

const tones = {
  accent: "border-action/28 bg-action/10 text-action-soft",
  neutral: "border-white/[0.08] bg-white/[0.06] text-muted",
  success: "border-success/24 bg-success-wash text-success",
  warning: "border-warning/24 bg-warning-wash text-warning",
  danger: "border-danger/24 bg-danger-wash text-danger",
};

export function Badge({ className, tone = "accent", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-[var(--radius-pill)] border px-3 font-mono text-[0.68rem] font-medium leading-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
