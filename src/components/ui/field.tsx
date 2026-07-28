import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type FieldProps = ComponentPropsWithoutRef<"label"> & {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
};

export function Field({ children, className, error, hint, label, ...props }: FieldProps) {
  return (
    <label className={cn("block space-y-2", className)} {...props}>
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs leading-5 text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs leading-5 text-muted-2">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={cn(
        "min-h-12 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none transition-[border-color,background,box-shadow,opacity] duration-[var(--motion-base)] ease-[var(--ease-premium)] placeholder:text-muted-2 hover:border-white/14 focus:border-action/70 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(255,106,0,0.12)] disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-none rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-4 py-3 text-sm leading-6 text-foreground shadow-[var(--shadow-hairline)] outline-none transition-[border-color,background,box-shadow,opacity] duration-[var(--motion-base)] ease-[var(--ease-premium)] placeholder:text-muted-2 hover:border-white/14 focus:border-action/70 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(255,106,0,0.12)] disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}

type CheckProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  label: string;
  description?: string;
};

export function Checkbox({ className, description, label, ...props }: CheckProps) {
  return (
    <label className="group flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] p-1 transition-colors hover:bg-white/[0.035]">
      <input
        type="checkbox"
        className={cn(
          "mt-0.5 size-5 shrink-0 appearance-none rounded-[6px] border border-white/14 bg-white/[0.06] shadow-[var(--shadow-hairline)] transition-[background,border-color,box-shadow,opacity] duration-[var(--motion-base)] ease-[var(--ease-premium)] checked:border-action checked:bg-action checked:shadow-[inset_0_0_0_4px_var(--p30-black)] focus-visible:outline-action-soft disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function Radio({ className, description, label, ...props }: CheckProps) {
  return (
    <label className="group flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] p-1 transition-colors hover:bg-white/[0.035]">
      <input
        type="radio"
        className={cn(
          "mt-0.5 size-5 shrink-0 appearance-none rounded-full border border-white/14 bg-white/[0.06] shadow-[var(--shadow-hairline)] transition-[background,border-color,box-shadow,opacity] duration-[var(--motion-base)] ease-[var(--ease-premium)] checked:border-action checked:bg-action checked:shadow-[inset_0_0_0_5px_var(--p30-black)] focus-visible:outline-action-soft disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  label: string;
  description?: string;
};

export function Switch({ className, description, label, ...props }: SwitchProps) {
  return (
    <label className="group flex cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-card)] p-1 transition-colors hover:bg-white/[0.035]">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={cn(
          "h-7 w-12 shrink-0 appearance-none rounded-[var(--radius-pill)] border border-white/12 bg-white/[0.07] bg-[radial-gradient(circle_at_14px_50%,#f8f6f1_0_5px,transparent_6px)] shadow-[var(--shadow-hairline)] transition-[background,border-color,opacity] duration-[var(--motion-base)] ease-[var(--ease-premium)] checked:border-action/40 checked:bg-action/25 checked:bg-[radial-gradient(circle_at_34px_50%,#ff9a3d_0_5px,transparent_6px)] focus-visible:outline-action-soft disabled:cursor-not-allowed disabled:opacity-45",
          className,
        )}
        {...props}
      />
    </label>
  );
}
