import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ButtonBaseProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

type ButtonAsButtonProps = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: "button";
  };

type ButtonAsAnchorProps = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: "a";
    disabled?: boolean;
  };

type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps;

const variants = {
  primary:
    "border-action bg-action text-background shadow-[0_16px_44px_rgba(255,106,0,0.22)] hover:bg-action-soft active:bg-action",
  secondary:
    "border-white/10 bg-white/[0.06] text-foreground shadow-[var(--shadow-hairline)] hover:border-white/18 hover:bg-white/[0.09] active:bg-white/[0.07]",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-white/[0.06] hover:text-foreground active:bg-white/[0.08]",
  danger:
    "border-danger/30 bg-danger-wash text-danger hover:border-danger/45 hover:bg-danger/15 active:bg-danger/20",
};

const sizes = {
  xs: "min-h-7 gap-1.5 px-2.5 text-[0.7rem]",
  sm: "min-h-9 gap-2 px-3 text-xs",
  md: "min-h-11 gap-2.5 px-4 text-sm",
  lg: "min-h-13 gap-3 px-5 text-sm",
};

const baseClass =
  "inline-flex select-none items-center justify-center rounded-[var(--radius-pill)] border font-semibold transition-[background,border-color,color,box-shadow,transform,opacity] duration-[var(--motion-base)] ease-[var(--ease-premium)] focus-visible:outline-action-soft disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 active:scale-[0.985]";

function LoadingDot() {
  return (
    <span
      aria-hidden="true"
      className="size-2 rounded-full bg-current opacity-80 [animation:p30-pulse_900ms_var(--ease-premium)_infinite]"
    />
  );
}

export function Button(props: ButtonProps) {
  const {
    as = "button",
    className,
    children,
    disabled,
    leadingIcon,
    loading = false,
    size = "md",
    trailingIcon,
    variant = "primary",
    ...rest
  } = props;
  const isDisabled = Boolean(disabled || loading);
  const classes = cn(baseClass, variants[variant], sizes[size], className);
  const content = (
    <>
      {loading ? <LoadingDot /> : leadingIcon}
      <span className="min-w-0">{children}</span>
      {trailingIcon}
    </>
  );

  if (as === "a") {
    return (
      <a
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        className={classes}
        tabIndex={isDisabled ? -1 : undefined}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      aria-busy={loading || undefined}
      className={classes}
      disabled={isDisabled}
      type="button"
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
}
