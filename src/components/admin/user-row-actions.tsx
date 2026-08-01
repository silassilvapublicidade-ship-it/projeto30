"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ResetPasswordDialog } from "@/components/admin/reset-password-button";
import {
  deleteUserAction,
  requirePasswordChangeAction,
  updateUserStatusAction,
} from "@/features/admin/admin-users.actions";
import type { UserStatus } from "@/server/services/admin-users.service";

type UserRowActionsProps = {
  mustChangePassword: boolean;
  redirectTo: string;
  status: UserStatus;
  userEmail: string;
  userId: string;
};

function StatusForm({
  action,
  children,
  close,
  redirectTo,
  status,
  userId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  close: () => void;
  redirectTo: string;
  status?: UserStatus;
  userId: string;
}) {
  return (
    <form action={action} onSubmit={close}>
      <input name="userId" type="hidden" value={userId} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      {status ? <input name="status" type="hidden" value={status} /> : null}
      <DropdownMenuItem type="submit">{children}</DropdownMenuItem>
    </form>
  );
}

export function UserRowActions({
  mustChangePassword,
  redirectTo,
  status,
  userEmail,
  userId,
}: UserRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <>
      <DropdownMenu label={`Ações para ${userEmail}`}>
        {({ close }) => (
          <>
            <DropdownMenuItem href={`/admin/usuarios/${userId}`}>Ver detalhes</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                close();
                setResetOpen(true);
              }}
            >
              Redefinir senha
            </DropdownMenuItem>

            {!mustChangePassword ? (
              <StatusForm action={requirePasswordChangeAction} close={close} redirectTo={redirectTo} userId={userId}>
                Exigir troca de senha
              </StatusForm>
            ) : null}

            <DropdownMenuSeparator />

            {status !== "active" ? (
              <StatusForm
                action={updateUserStatusAction}
                close={close}
                redirectTo={redirectTo}
                status="active"
                userId={userId}
              >
                Ativar
              </StatusForm>
            ) : null}

            {status !== "inactive" ? (
              <StatusForm
                action={updateUserStatusAction}
                close={close}
                redirectTo={redirectTo}
                status="inactive"
                userId={userId}
              >
                Desativar
              </StatusForm>
            ) : null}

            {status !== "suspended" ? (
              <StatusForm
                action={updateUserStatusAction}
                close={close}
                redirectTo={redirectTo}
                status="suspended"
                userId={userId}
              >
                Bloquear
              </StatusForm>
            ) : null}

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

      <ResetPasswordDialog onOpenChange={setResetOpen} open={resetOpen} userEmail={userEmail} userId={userId} />

      <ConfirmDialog
        confirmLabel="Excluir definitivamente"
        description={`Esta ação excluirá definitivamente a conta de "${userEmail}", incluindo inscrições, progresso e histórico. Não pode ser desfeita. Confirma a exclusão?`}
        formAction={deleteUserAction}
        hiddenFields={{ redirectTo, userId }}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        title="Excluir usuário?"
      />
    </>
  );
}
