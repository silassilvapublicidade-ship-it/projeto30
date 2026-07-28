import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type CardProps = ComponentPropsWithoutRef<"article"> & {
  tone?: "base" | "soft" | "glass" | "accent";
};

const tones = {
  base: "border-white/[0.08] bg-surface/76 shadow-[var(--shadow-hairline)]",
  soft: "border-line-soft bg-graphite/84 shadow-[var(--shadow-hairline)]",
  glass:
    "border-white/[0.10] bg-white/[0.055] shadow-[var(--shadow-soft)] backdrop-blur-xl",
  accent:
    "border-action/24 bg-[linear-gradient(180deg,rgba(255,106,0,0.14),rgba(255,255,255,0.045))] shadow-[var(--shadow-hairline)]",
};

export function Card({ className, tone = "base", ...props }: CardProps) {
  return (
    <article
      className={cn(
        "rounded-[var(--radius-card)] border p-5 transition-[border-color,background,transform,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-premium)] hover:-translate-y-0.5 hover:border-white/14 sm:p-6",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      className={cn("text-base font-semibold leading-6 text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-sm leading-6 text-muted", className)} {...props} />;
}
