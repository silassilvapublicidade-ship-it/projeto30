import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { MoreHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogPreviewProps = ComponentPropsWithoutRef<"section"> & {
  title: string;
  description: string;
  children?: ReactNode;
};

export function DialogPreview({
  children,
  className,
  description,
  title,
  ...props
}: DialogPreviewProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/92 p-5 shadow-[var(--shadow-lift)]",
        className,
      )}
      role="dialog"
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
        <button
          aria-label="Fechar"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.055] text-muted transition-colors hover:text-foreground focus-visible:outline-action-soft"
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

type SheetPreviewProps = ComponentPropsWithoutRef<"aside"> & {
  title: string;
  description: string;
  children?: ReactNode;
};

export function SheetPreview({
  children,
  className,
  description,
  title,
  ...props
}: SheetPreviewProps) {
  return (
    <aside
      aria-label={title}
      className={cn(
        "rounded-t-[var(--radius-card)] border border-white/[0.10] bg-graphite/95 p-5 shadow-[var(--shadow-lift)] sm:rounded-[var(--radius-card)]",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/18 sm:hidden" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </aside>
  );
}

type DropdownProps = ComponentPropsWithoutRef<"details"> & {
  label: string;
  items: string[];
};

export function Dropdown({ className, items, label, ...props }: DropdownProps) {
  return (
    <details className={cn("group relative", className)} {...props}>
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-pill)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm font-semibold text-foreground shadow-[var(--shadow-hairline)] transition-colors hover:bg-white/[0.08] focus-visible:outline-action-soft [&::-webkit-details-marker]:hidden">
        {label}
        <MoreHorizontal aria-hidden="true" size={16} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-52 rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/96 p-1 shadow-[var(--shadow-lift)] backdrop-blur-xl">
        {items.map((item) => (
          <button
            className="flex min-h-10 w-full items-center rounded-[6px] px-3 text-left text-sm text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-action-soft"
            key={item}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
    </details>
  );
}

export function ConfirmActions() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button variant="ghost">Agora nao</Button>
      <Button>Salvar ritmo</Button>
    </div>
  );
}
