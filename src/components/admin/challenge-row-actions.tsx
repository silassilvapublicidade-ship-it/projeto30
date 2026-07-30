"use client";

import { useState } from "react";

import { DeleteChallengeDialog } from "@/components/admin/delete-challenge-dialog";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  archiveChallengeAction,
  publishChallengeAction,
  unpublishChallengeAction,
} from "@/features/admin/admin-challenges.actions";
import { duplicateChallengeAsDraftAction } from "@/features/admin/challenge-editor.actions";
import type { ChallengeStatus } from "@/server/services/admin-analytics.service";

type ChallengeRowActionsProps = {
  challengeId: string;
  challengeName: string;
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
  participantCount,
  redirectTo,
  status,
}: ChallengeRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = status === "draft" && participantCount === 0;

  return (
    <>
      <DropdownMenu label={`Ações para ${challengeName}`}>
        {({ close }) => (
          <>
            {status === "active" || status === "archived" ? (
              <DropdownMenuItem href={`/admin/desafios/${challengeId}`}>Ver detalhes</DropdownMenuItem>
            ) : null}

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
                action={archiveChallengeAction}
                close={close}
                hiddenChallengeId={challengeId}
                redirectTo={redirectTo}
              >
                Arquivar
              </ActionForm>
            ) : null}

            {status === "draft" || status === "active" || status === "archived" ? (
              <ActionForm
                action={duplicateChallengeAsDraftAction}
                close={close}
                hiddenChallengeId={challengeId}
                redirectTo={redirectTo}
              >
                Duplicar
              </ActionForm>
            ) : null}

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
    </>
  );
}
