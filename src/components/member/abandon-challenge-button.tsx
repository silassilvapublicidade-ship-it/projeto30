"use client";

import { useState } from "react";

import { abandonChallengeAction } from "@/features/member/challenge-abandonment.actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function AbandonChallengeButton({
  challengeName,
  enrollmentId,
}: {
  challengeName: string;
  enrollmentId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label={`Abandonar ${challengeName}`}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="ghost"
      >
        Abandonar desafio
      </Button>

      <ConfirmDialog
        confirmLabel="Abandonar desafio"
        description="Seu progresso e suas anotações serão preservados, mas você não poderá continuar registrando atividades neste desafio."
        formAction={abandonChallengeAction}
        hiddenFields={{ enrollmentId }}
        onOpenChange={setOpen}
        open={open}
        title="Abandonar desafio?"
      />
    </>
  );
}
