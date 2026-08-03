"use client";

import { useState } from "react";

import {
  archiveTipAction,
  duplicateTipAsDraftAction,
  publishTipAction,
  unpublishTipAction,
} from "@/features/admin/admin-tips.actions";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TipDeleteDialog } from "@/components/admin/tip-delete-dialog";

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
  extraFields,
  hiddenTipId,
  redirectTo,
  tone = "default",
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  close: () => void;
  extraFields?: Record<string, string>;
  hiddenTipId: string;
  redirectTo: string;
  tone?: "danger" | "default";
}) {
  return (
    <form action={action} onSubmit={close}>
      <input name="tipId" type="hidden" value={hiddenTipId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {Object.entries(extraFields ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
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
 * user-history dependency - deleting one is low-stakes, so its
 * confirmation is a plain modal (TipDeleteDialog), not a name-typed one.
 */
export function TipRowActions({ redirectTo, status, tipId, tipTitle }: TipRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu label={`Ações para ${tipTitle}`}>
        {({ close }) => (
          <>
            <DropdownMenuItem href={`/admin/dicas/${tipId}/preview`}>Ver prévia</DropdownMenuItem>
            <DropdownMenuItem href={`/admin/dicas/${tipId}/editar`}>Editar</DropdownMenuItem>

            {status === "draft" || status === "archived" ? (
              <>
                <ActionForm action={publishTipAction} close={close} hiddenTipId={tipId} redirectTo={redirectTo}>
                  {status === "draft" ? "Publicar" : "Publicar novamente"}
                </ActionForm>
                <ActionForm
                  action={publishTipAction}
                  close={close}
                  extraFields={{ notifyUsers: "on" }}
                  hiddenTipId={tipId}
                  redirectTo={redirectTo}
                >
                  {status === "draft" ? "Publicar e avisar usuários" : "Publicar novamente e avisar usuários"}
                </ActionForm>
              </>
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

            <DropdownMenuItem
              onSelect={() => {
                close();
                setDeleteOpen(true);
              }}
              tone="danger"
            >
              Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenu>

      <TipDeleteDialog
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        redirectTo={redirectTo}
        tipId={tipId}
        tipTitle={tipTitle}
      />
    </>
  );
}
