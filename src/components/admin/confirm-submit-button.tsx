"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  confirmMessage: string;
  size?: "lg" | "md" | "sm" | "xs";
  variant?: "danger" | "ghost" | "primary" | "secondary";
};

/**
 * Wraps a submit button with a native confirm() prompt for destructive
 * status transitions (e.g. archiving a challenge). Progressive-enhancement
 * safe: without JS the form still submits without a confirmation prompt,
 * since archiving only changes a status column and is not a delete.
 */
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  size = "md",
  variant = "primary",
}: ConfirmSubmitButtonProps) {
  return (
    <Button
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
      size={size}
      type="submit"
      variant={variant}
    >
      {children}
    </Button>
  );
}
