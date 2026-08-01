"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { deleteUserAction } from "@/features/admin/admin-users.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";

export function UserRowActions({
  redirectTo,
  userEmail,
  userId,
}: {
  redirectTo: string;
  userEmail: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <ResetPasswordButton userEmail={userEmail} userId={userId} />
        <button
          aria-label={`Excluir usuário ${userEmail}`}
          className="flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-white/[0.08] text-muted transition-colors hover:border-danger/40 hover:bg-danger-wash hover:text-danger focus-visible:outline-action-soft"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Trash2 aria-hidden="true" size={15} />
        </button>
      </div>

      <ConfirmDialog
        confirmLabel="Excluir definitivamente"
        description={`Esta ação excluirá definitivamente a conta de "${userEmail}", incluindo inscrições, progresso e histórico. Não pode ser desfeita. Confirma a exclusão?`}
        formAction={deleteUserAction}
        hiddenFields={{ redirectTo, userId }}
        onOpenChange={setOpen}
        open={open}
        title="Excluir usuário?"
      />
    </>
  );
}
