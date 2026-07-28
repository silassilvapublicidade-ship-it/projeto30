import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = ComponentPropsWithoutRef<"span">;

export function Badge({ className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-sm border border-action/50 bg-action/10 px-3 font-mono text-xs font-semibold uppercase text-action-soft",
        className,
      )}
      {...props}
    />
  );
}
