"use client";

import { useEffect, useId, useState } from "react";

import {
  getTestChallengePurgePreviewAction,
  purgeTestChallengeAction,
  type PurgePreviewResult,
} from "@/features/admin/admin-challenges.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const REQUIRED_PHRASE = "EXCLUIR PERMANENTEMENTE";

type PurgeTestChallengeDialogProps = {
  challengeId: string;
  challengeName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  redirectTo: string;
};

const countLabels: Record<string, string> = {
  analytics_events: "Eventos de analytics",
  daily_logs: "Diários de dia (daily logs)",
  enrollments: "Participantes/inscrições",
  habit_logs: "Registros de hábitos",
  journal_entries: "Entradas de diário pessoal",
  point_events: "Eventos de pontos",
};

/**
 * Restricted to super_admin + challenges explicitly marked is_test = true
 * (see ChallengeRowActions). Unlike DeleteChallengeDialog (which the FK
 * restrict on challenge_enrollments always blocks once there's any real
 * history), this purges history on purpose - so it requires BOTH the exact
 * challenge name AND the exact phrase "EXCLUIR PERMANENTEMENTE", and shows
 * real server-computed counts of what will be removed before either input
 * is even usable.
 */
export function PurgeTestChallengeDialog({
  challengeId,
  challengeName,
  onOpenChange,
  open,
  redirectTo,
}: PurgeTestChallengeDialogProps) {
  const [typedName, setTypedName] = useState("");
  const [typedPhrase, setTypedPhrase] = useState("");
  const [preview, setPreview] = useState<PurgePreviewResult | null>(null);
  const nameInputId = useId();
  const phraseInputId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    getTestChallengePurgePreviewAction(challengeId).then((result) => {
      if (!cancelled) {
        setPreview(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, challengeId]);

  // Reset happens in the event handler (not an effect) - closing the dialog
  // is a direct consequence of a user action, not a state synchronization
  // concern, so this belongs here rather than in a useEffect cleanup/branch.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setTypedName("");
      setTypedPhrase("");
      setPreview(null);
    }
    onOpenChange(next);
  }

  const confirmDisabled =
    typedName !== challengeName || typedPhrase !== REQUIRED_PHRASE || !preview?.ok;

  return (
    <ConfirmDialog
      confirmDisabled={confirmDisabled}
      confirmLabel="Excluir permanentemente"
      description="Esta ação excluirá definitivamente este desafio de teste e todo o seu histórico. Isso não pode ser desfeito."
      formAction={purgeTestChallengeAction}
      hiddenFields={{ challengeId, redirectTo }}
      onOpenChange={handleOpenChange}
      open={open}
      title={`Excluir permanentemente "${challengeName}"?`}
    >
      <div className="mt-4 rounded-[var(--radius-control)] border border-danger/25 bg-danger-wash p-3">
        {!preview ? (
          <p className="text-xs text-muted">Carregando o que será removido...</p>
        ) : !preview.ok ? (
          <p className="text-xs text-danger">{preview.message}</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-danger">Será removido permanentemente:</p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
              {Object.entries(preview.preview.counts).map(([key, value]) => (
                <li key={key}>
                  {countLabels[key] ?? key}: <strong className="text-foreground">{value}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

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

      <div className="mt-3">
        <label className="text-xs font-medium text-muted" htmlFor={phraseInputId}>
          Digite a frase exata: &ldquo;{REQUIRED_PHRASE}&rdquo;
        </label>
        <input
          autoComplete="off"
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
          id={phraseInputId}
          name="confirmationPhrase"
          onChange={(event) => setTypedPhrase(event.target.value)}
          placeholder={REQUIRED_PHRASE}
          spellCheck={false}
          type="text"
          value={typedPhrase}
        />
      </div>
    </ConfirmDialog>
  );
}
