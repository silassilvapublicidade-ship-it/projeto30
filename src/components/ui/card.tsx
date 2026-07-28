import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type CardProps = ComponentPropsWithoutRef<"article">;

export function Card({ className, ...props }: CardProps) {
  return (
    <article
      className={cn(
        "rounded-sm border border-line bg-panel/80 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)]",
        className,
      )}
      {...props}
    />
  );
}
