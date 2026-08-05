"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteFeedbackAction } from "@/features/admin/feedback-admin.actions";
import { FEEDBACK_DELETE_CONFIRMATION_PHRASE } from "@/features/feedback/feedback.core";

export function FeedbackDeleteButton({ feedbackId }: { feedbackId: string }) {
  const [open, setOpen] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const inputId = useId();

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="danger">
        Excluir definitivamente
      </Button>
      <ConfirmDialog
        confirmDisabled={typedPhrase !== FEEDBACK_DELETE_CONFIRMATION_PHRASE}
        confirmLabel="Excluir para sempre"
        description="Esta ação remove o feedback e o anexo permanentemente. Não pode ser desfeita."
        formAction={deleteFeedbackAction}
        hiddenFields={{ id: feedbackId, confirmationPhrase: typedPhrase }}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTypedPhrase("");
        }}
        open={open}
        title="Excluir feedback definitivamente?"
      >
        <div className="mt-4">
          <label className="text-xs font-medium text-muted" htmlFor={inputId}>
            Digite a frase exata: &ldquo;{FEEDBACK_DELETE_CONFIRMATION_PHRASE}&rdquo;
          </label>
          <input
            autoComplete="off"
            className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
            id={inputId}
            onChange={(event) => setTypedPhrase(event.target.value)}
            placeholder={FEEDBACK_DELETE_CONFIRMATION_PHRASE}
            spellCheck={false}
            type="text"
            value={typedPhrase}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
