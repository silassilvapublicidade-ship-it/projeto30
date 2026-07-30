"use client";

import {
  archiveTipAction,
  duplicateTipAsDraftAction,
  publishTipAction,
  unpublishTipAction,
  deleteTipAction,
} from "@/features/admin/admin-tips.actions";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type TipStatus = "archived" | "draft" | "published";

type TipRowActionsProps = {
  redirectTo: string;
  status: TipStatus;
  tipId: string;
  tipTitle: string;
};

function ActionForm({
  action,
  children,
  close,
  hiddenTipId,
  redirectTo,
  tone = "default",
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  close: () => void;
  hiddenTipId: string;
  redirectTo: string;
  tone?: "danger" | "default";
}) {
  return (
    <form action={action} onSubmit={close}>
      <input name="tipId" type="hidden" value={hiddenTipId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <DropdownMenuItem tone={tone} type="submit">
        {children}
      </DropdownMenuItem>
    </form>
  );
}

/**
 * Same DropdownMenu primitive and per-status gating philosophy as
 * ChallengeRowActions. Unlike challenge deletion (blocked by real
 * enrollment/log history via an FK restrict), a tip card has no
 * user-history dependency - deleting one is low-stakes, so it only needs a
 * plain window.confirm() guard, not a name-typed modal.
 */
export function TipRowActions({ redirectTo, status, tipId, tipTitle }: TipRowActionsProps) {
  return (
    <DropdownMenu label={`Ações para ${tipTitle}`}>
      {({ close }) => (
        <>
          <DropdownMenuItem href={`/admin/dicas/${tipId}/preview`}>Ver preview</DropdownMenuItem>

          {status === "draft" || status === "published" ? (
            <DropdownMenuItem href={`/admin/dicas/${tipId}/editar`}>Editar</DropdownMenuItem>
          ) : null}

          {status === "draft" ? (
            <ActionForm action={publishTipAction} close={close} hiddenTipId={tipId} redirectTo={redirectTo}>
              Publicar
            </ActionForm>
          ) : null}

          {status === "published" ? (
            <ActionForm
              action={unpublishTipAction}
              close={close}
              hiddenTipId={tipId}
              redirectTo={redirectTo}
            >
              Despublicar
            </ActionForm>
          ) : null}

          {status === "published" ? (
            <ActionForm action={archiveTipAction} close={close} hiddenTipId={tipId} redirectTo={redirectTo}>
              Arquivar
            </ActionForm>
          ) : null}

          <ActionForm
            action={duplicateTipAsDraftAction}
            close={close}
            hiddenTipId={tipId}
            redirectTo={redirectTo}
          >
            Duplicar
          </ActionForm>

          <DropdownMenuSeparator />

          <form action={deleteTipAction} onSubmit={close}>
            <input name="tipId" type="hidden" value={tipId} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <DropdownMenuItem
              onSelect={(event) => {
                if (!window.confirm(`Excluir definitivamente a dica "${tipTitle}"?`)) {
                  event.preventDefault();
                }
              }}
              tone="danger"
              type="submit"
            >
              Excluir
            </DropdownMenuItem>
          </form>
        </>
      )}
    </DropdownMenu>
  );
}
