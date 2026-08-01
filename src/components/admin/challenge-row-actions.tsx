"use client";

import { useState } from "react";

import { DeleteChallengeDialog } from "@/components/admin/delete-challenge-dialog";
import { EndChallengeDialog } from "@/components/admin/end-challenge-dialog";
import { PurgeTestChallengeDialog } from "@/components/admin/purge-test-challenge-dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  archiveChallengeAction,
  pauseChallengeAction,
  publishChallengeAction,
  resumeChallengeAction,
  unpublishChallengeAction,
} from "@/features/admin/admin-challenges.actions";
import { duplicateChallengeAsDraftAction } from "@/features/admin/challenge-editor.actions";
import type { ChallengeStatus } from "@/server/services/admin-analytics.service";

type ChallengeRowActionsProps = {
  challengeId: string;
  challengeName: string;
  isSuperAdmin: boolean;
  isTest: boolean;
  participantCount: number;
  redirectTo: string;
  status: ChallengeStatus;
};

/**
 * Form-action menu items post directly (no client JS needed for the action
 * itself, only for closing the menu after selection). Submitting always
 * redirects server-side (see admin-challenges.actions.ts), which naturally
 * unmounts/remounts this row and closes the menu - the onSelect here only
 * needs to close it immediately for the common case where JS runs and the
 * navigation takes a moment.
 */
function ActionForm({
  action,
  children,
  close,
  hiddenChallengeId,
  redirectTo,
  tone = "default",
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  close: () => void;
  hiddenChallengeId: string;
  redirectTo: string;
  tone?: "danger" | "default";
}) {
  return (
    <form action={action} onSubmit={close}>
      <input name="challengeId" type="hidden" value={hiddenChallengeId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <DropdownMenuItem tone={tone} type="submit">
        {children}
      </DropdownMenuItem>
    </form>
  );
}

export function ChallengeRowActions({
  challengeId,
  challengeName,
  isSuperAdmin,
  isTest,
  participantCount,
  redirectTo,
  status,
}: ChallengeRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  // A challenge can be deleted (physically) in ANY status as long as it has
  // zero participants/history - the earlier version of this component only
  // allowed it for status === "draft", which is why "Excluir" never showed
  // up for an archived challenge like "Projeto 30 - Validacao Interna" even
  // though the business rule (zero real history) would have allowed it. The
  // actual safety net is unchanged: deleteChallengeAction still relies on
  // challenge_enrollments.challenge_id being ON DELETE RESTRICT, so even if
  // this check is ever wrong (stale participantCount), the database itself
  // rejects the delete with 23503 rather than losing real history.
  const canDelete = participantCount === 0;
  // Permanent purge (with history) is reserved for challenges explicitly
  // marked is_test = true, and only super_admin ever sees the option - never
  // a path available for a real challenge just because it's archived.
  const canPurge = isSuperAdmin && isTest && status === "archived";
  const showDestructiveSeparator = canDelete || canPurge;

  return (
    <>
      <DropdownMenu label={`Ações para ${challengeName}`}>
        {({ close }) => (
          <>
            <DropdownMenuItem href={`/admin/desafios/${challengeId}`}>Ver detalhes</DropdownMenuItem>

            {status === "draft" || status === "active" ? (
              <DropdownMenuItem href={`/admin/desafios/${challengeId}/editar`}>Editar</DropdownMenuItem>
            ) : null}

            {status === "draft" ? (
              <ActionForm
                action={publishChallengeAction}
                close={close}
                hiddenChallengeId={challengeId}
                redirectTo={redirectTo}
              >
                Publicar
              </ActionForm>
            ) : null}

            {status === "active" ? (
              <ActionForm
                action={unpublishChallengeAction}
                close={close}
                hiddenChallengeId={challengeId}
                redirectTo={redirectTo}
              >
                Despublicar
              </ActionForm>
            ) : null}

            {status === "active" ? (
              <ActionForm
                action={pauseChallengeAction}
                close={close}
                hiddenChallengeId={challengeId}
                redirectTo={redirectTo}
              >
                Pausar
              </ActionForm>
            ) : null}

            {status === "paused" ? (
              <ActionForm
                action={resumeChallengeAction}
                close={close}
                hiddenChallengeId={challengeId}
                redirectTo={redirectTo}
              >
                Retomar
              </ActionForm>
            ) : null}

            {status === "active" || status === "paused" ? (
              <DropdownMenuItem
                onSelect={() => {
                  close();
                  setEndOpen(true);
                }}
              >
                Encerrar
              </DropdownMenuItem>
            ) : null}

            {status === "active" || status === "paused" || status === "ended" ? (
              <ActionForm
                action={archiveChallengeAction}
                close={close}
                hiddenChallengeId={challengeId}
                redirectTo={redirectTo}
              >
                Arquivar
              </ActionForm>
            ) : null}

            <ActionForm
              action={duplicateChallengeAsDraftAction}
              close={close}
              hiddenChallengeId={challengeId}
              redirectTo={redirectTo}
            >
              Duplicar
            </ActionForm>

            {showDestructiveSeparator ? <DropdownMenuSeparator /> : null}

            {canDelete ? (
              <DropdownMenuItem
                onSelect={() => {
                  close();
                  setDeleteOpen(true);
                }}
                tone="danger"
              >
                Excluir
              </DropdownMenuItem>
            ) : null}

            {canPurge ? (
              <DropdownMenuItem
                onSelect={() => {
                  close();
                  setPurgeOpen(true);
                }}
                tone="critical"
              >
                Excluir permanentemente (teste)
              </DropdownMenuItem>
            ) : null}
          </>
        )}
      </DropdownMenu>

      {canDelete ? (
        <DeleteChallengeDialog
          challengeId={challengeId}
          challengeName={challengeName}
          onOpenChange={setDeleteOpen}
          open={deleteOpen}
          redirectTo={redirectTo}
        />
      ) : null}

      {canPurge ? (
        <PurgeTestChallengeDialog
          challengeId={challengeId}
          challengeName={challengeName}
          onOpenChange={setPurgeOpen}
          open={purgeOpen}
          redirectTo={redirectTo}
        />
      ) : null}

      <EndChallengeDialog
        challengeId={challengeId}
        challengeName={challengeName}
        onOpenChange={setEndOpen}
        open={endOpen}
        redirectTo={redirectTo}
      />
    </>
  );
}
