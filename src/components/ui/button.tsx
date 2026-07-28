import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonBaseProps = {
  variant?: "primary" | "secondary";
};

type ButtonAsButtonProps = ButtonBaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    as?: "button";
  };

type ButtonAsAnchorProps = ButtonBaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    as: "a";
  };

type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps;

const variants = {
  primary:
    "border-action bg-action text-background hover:bg-action-soft hover:text-background",
  secondary:
    "border-line bg-panel/80 text-foreground hover:border-action hover:text-action-soft",
};

export function Button(props: ButtonProps) {
  const { as = "button", className, variant = "primary", ...rest } = props;
  const classes = cn(
    "inline-flex min-h-12 items-center justify-center rounded-sm border px-5 text-sm font-bold uppercase transition-colors focus-visible:outline-action-soft disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    className,
  );

  if (as === "a") {
    return (
      <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} />
    );
  }

  return (
    <button
      className={classes}
      type="button"
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    />
  );
}
