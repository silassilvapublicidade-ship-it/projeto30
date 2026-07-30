"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type DeleteChallengeButtonProps = {
  challengeName: string;
};

/**
 * Destructive, physical deletion - a stronger confirmation than
 * ConfirmSubmitButton (used for archiving, a reversible status change).
 * Requires the admin to both confirm the warning AND type the exact
 * challenge name, mirroring the "segunda confirmacao" the audit asked for
 * without introducing a modal/dialog primitive the project doesn't have.
 * Progressive-enhancement safe: without JS the form still submits (the
 * server still enforces the zero-participants rule via the FK), it just
 * skips the extra confirmation step.
 */
export function DeleteChallengeButton({ challengeName }: DeleteChallengeButtonProps) {
  const { pending } = useFormStatus();

  function handleClick(event: React.MouseEvent) {
    const confirmed = window.confirm(
      `Excluir definitivamente "${challengeName}"? Esta acao remove o desafio, seus habitos e dias, e nao pode ser desfeita.`,
    );

    if (!confirmed) {
      event.preventDefault();
      return;
    }

    const typed = window.prompt(
      `Para confirmar, digite exatamente o nome do desafio: "${challengeName}"`,
    );

    if (typed !== challengeName) {
      window.alert("O nome digitado nao confere. Exclusao cancelada.");
      event.preventDefault();
    }
  }

  return (
    <Button loading={pending} onClick={handleClick} size="sm" type="submit" variant="danger">
      {pending ? "Excluindo" : "Excluir"}
    </Button>
  );
}
