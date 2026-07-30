"use client";

import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteChallengeAction } from "@/features/admin/admin-challenges.actions";

type DeleteChallengeDialogProps = {
  challengeId: string;
  challengeName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  redirectTo: string;
};

/**
 * Real <dialog>-backed confirmation, replacing the earlier native
 * confirm/prompt browser dialogs: requires typing the exact
 * challenge name before the destructive submit
 * button ever becomes clickable. Only ever mounted for challenges with zero
 * participants (see ChallengeRowActions) - the server action independently
 * re-enforces that via the challenge_enrollments FK (23503 -> "delete-blocked"),
 * so this modal is a UX gate, never the only safety net.
 */
export function DeleteChallengeDialog({
  challengeId,
  challengeName,
  onOpenChange,
  open,
  redirectTo,
}: DeleteChallengeDialogProps) {
  const [typedName, setTypedName] = useState("");
  const inputId = useId();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTypedName("");
    }
    onOpenChange(next);
  }

  return (
    <ConfirmDialog
      confirmDisabled={typedName !== challengeName}
      confirmLabel="Excluir definitivamente"
      description={`Esta ação excluirá definitivamente este desafio. Isso remove o desafio, seus dias e hábitos configurados, e não pode ser desfeita.`}
      formAction={deleteChallengeAction}
      hiddenFields={{ challengeId, redirectTo }}
      onOpenChange={handleOpenChange}
      open={open}
      title={`Excluir "${challengeName}"?`}
    >
      <div className="mt-4">
        <label className="text-xs font-medium text-muted" htmlFor={inputId}>
          Para confirmar, digite o nome exato do desafio: &ldquo;{challengeName}&rdquo;
        </label>
        <input
          autoComplete="off"
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
          id={inputId}
          onChange={(event) => setTypedName(event.target.value)}
          placeholder={challengeName}
          spellCheck={false}
          type="text"
          value={typedName}
        />
      </div>
    </ConfirmDialog>
  );
}
