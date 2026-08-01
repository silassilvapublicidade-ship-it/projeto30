"use client";

import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { endChallengeAction } from "@/features/admin/admin-challenges.actions";

type EndChallengeDialogProps = {
  challengeId: string;
  challengeName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  redirectTo: string;
};

/**
 * Ending is one-way from this UI (brief: "nao permitir retomar sem acao
 * especial") and preserves everything - unlike the purge dialog, there's no
 * history to show being removed, just a status change that needs to be
 * deliberate. Same confirm-by-name pattern as PurgeTestChallengeDialog,
 * without the destructive-counts preview since nothing is deleted.
 */
export function EndChallengeDialog({
  challengeId,
  challengeName,
  onOpenChange,
  open,
  redirectTo,
}: EndChallengeDialogProps) {
  const [typedName, setTypedName] = useState("");
  const nameInputId = useId();

  function handleOpenChange(next: boolean) {
    if (!next) {
      setTypedName("");
    }
    onOpenChange(next);
  }

  return (
    <ConfirmDialog
      confirmDisabled={typedName !== challengeName}
      confirmLabel="Encerrar desafio"
      description="O desafio será encerrado para todos os participantes. Progresso, pontos, sequência e histórico continuam preservados e visíveis na administração. Esta ação não pode ser desfeita por aqui."
      formAction={endChallengeAction}
      hiddenFields={{ challengeId, redirectTo }}
      onOpenChange={handleOpenChange}
      open={open}
      title={`Encerrar "${challengeName}"?`}
    >
      <div className="mt-4">
        <label className="text-xs font-medium text-muted" htmlFor={nameInputId}>
          Digite o nome exato do desafio: &ldquo;{challengeName}&rdquo;
        </label>
        <input
          autoComplete="off"
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
          id={nameInputId}
          name="confirmationName"
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
