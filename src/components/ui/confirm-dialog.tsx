"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  cancelLabel?: string;
  children?: ReactNode;
  confirmDisabled?: boolean;
  confirmLabel: string;
  description: string;
  formAction: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

function SubmitButton({
  confirmDisabled,
  confirmLabel,
}: {
  confirmDisabled?: boolean;
  confirmLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={confirmDisabled} loading={pending} type="submit" variant="danger">
      {confirmLabel}
    </Button>
  );
}

/**
 * Native <dialog>-backed modal: showModal()/close() give us a real focus
 * trap, ESC-to-close and a ::backdrop for free, without adding a Radix-style
 * dependency the project doesn't have yet. The whole dialog body is the
 * confirmation <form> itself, so Cancelar/Confirmar and any hidden fields
 * all submit together as one normal server-action post.
 */
export function ConfirmDialog({
  cancelLabel = "Cancelar",
  children,
  confirmDisabled = false,
  confirmLabel,
  description,
  formAction,
  hiddenFields = {},
  onOpenChange,
  open,
  title,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    function handleCancel(event: Event) {
      event.preventDefault();
      onOpenChange(false);
    }

    function handleClose() {
      onOpenChange(false);
    }

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onOpenChange]);

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={cn(
        "m-auto max-w-sm rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/96 p-0 text-foreground shadow-[var(--shadow-lift)] backdrop:bg-black/60",
      )}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
      ref={dialogRef}
    >
      <form
        action={formAction}
        className="p-5 sm:p-6"
        onSubmit={(event) => {
          // Belt-and-suspenders: a disabled submit button already blocks
          // Enter-to-submit in every real browser, but this keeps the gate
          // correct even if that submit button is momentarily re-enabled
          // (e.g. a future caller changing confirmDisabled reactively).
          if (confirmDisabled) {
            event.preventDefault();
          }
        }}
      >
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}

        <h2 className="text-base font-semibold text-foreground" id={titleId}>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted" id={descriptionId}>
          {description}
        </p>

        {children}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
            {cancelLabel}
          </Button>
          <SubmitButton confirmDisabled={confirmDisabled} confirmLabel={confirmLabel} />
        </div>
      </form>
    </dialog>
  );
}
