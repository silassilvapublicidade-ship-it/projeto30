"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ResetPasswordDialog } from "@/components/admin/reset-password-button";
import { Button } from "@/components/ui/button";
import {
  deleteUserAction,
  enrollUserInChallengeAction,
  requirePasswordChangeAction,
  updateUserRoleAction,
  updateUserStatusAction,
} from "@/features/admin/admin-users.actions";
import type { PublishedChallengeOption, UserRole, UserStatus } from "@/server/services/admin-users.service";

const roleOptions: { label: string; value: UserRole }[] = [
  { label: "Membro", value: "user" },
  { label: "Moderador", value: "moderator" },
  { label: "Administrador", value: "admin" },
  { label: "Super admin", value: "super_admin" },
];

const statusOptions: { label: string; value: Exclude<UserStatus, "deleted"> }[] = [
  { label: "Ativo", value: "active" },
  { label: "Desativado", value: "inactive" },
  { label: "Bloqueado", value: "suspended" },
];

function selectClassName() {
  return "min-h-11 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.055] px-3 text-sm text-foreground shadow-[var(--shadow-hairline)] outline-none";
}

export function UserDetailActions({
  canChangeRole,
  currentRole,
  currentStatus,
  isSelf,
  mustChangePassword,
  publishedChallenges,
  redirectTo,
  userEmail,
  userId,
}: {
  canChangeRole: boolean;
  currentRole: UserRole;
  currentStatus: UserStatus;
  isSelf: boolean;
  mustChangePassword: boolean;
  publishedChallenges: PublishedChallengeOption[];
  redirectTo: string;
  userEmail: string;
  userId: string;
}) {
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-foreground">Papel e status</h2>

        <form action={updateUserRoleAction} className="flex flex-wrap items-end gap-2">
          <input name="userId" type="hidden" value={userId} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <label className="flex-1 space-y-1.5">
            <span className="block text-xs font-semibold text-muted">Papel</span>
            <select className={selectClassName()} defaultValue={currentRole} disabled={isSelf} name="role">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={isSelf} size="md" type="submit">
            Alterar papel
          </Button>
        </form>
        {!canChangeRole ? (
          <p className="text-xs leading-5 text-muted-2">
            Apenas super_admin pode conceder ou revogar papéis administrativos (admin/super_admin).
          </p>
        ) : null}
        {isSelf ? (
          <p className="text-xs leading-5 text-muted-2">Você não pode alterar o próprio papel.</p>
        ) : null}

        <form action={updateUserStatusAction} className="flex flex-wrap items-end gap-2">
          <input name="userId" type="hidden" value={userId} />
          <input name="redirectTo" type="hidden" value={redirectTo} />
          <label className="flex-1 space-y-1.5">
            <span className="block text-xs font-semibold text-muted">Status</span>
            <select className={selectClassName()} defaultValue={currentStatus} disabled={isSelf} name="status">
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={isSelf} size="md" type="submit">
            Alterar status
          </Button>
        </form>
        {isSelf ? (
          <p className="text-xs leading-5 text-muted-2">
            Você não pode bloquear, desativar ou reativar a própria conta.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-foreground">Segurança</h2>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setResetOpen(true)} size="md" type="button" variant="secondary">
            Redefinir senha
          </Button>
          {!mustChangePassword ? (
            <form action={requirePasswordChangeAction}>
              <input name="userId" type="hidden" value={userId} />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <Button size="md" type="submit" variant="ghost">
                Exigir troca de senha
              </Button>
            </form>
          ) : (
            <p className="self-center text-xs leading-5 text-muted-2">Troca de senha já pendente.</p>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-foreground">Inscrever em desafio</h2>
        {publishedChallenges.length === 0 ? (
          <p className="text-xs leading-5 text-muted-2">Nenhum desafio publicado no momento.</p>
        ) : (
          <form action={enrollUserInChallengeAction} className="flex flex-wrap items-end gap-2">
            <input name="userId" type="hidden" value={userId} />
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <label className="flex-1 space-y-1.5">
              <span className="block text-xs font-semibold text-muted">Desafio publicado</span>
              <select className={selectClassName()} name="challengeId" required>
                {publishedChallenges.map((challenge) => (
                  <option key={challenge.id} value={challenge.id}>
                    {challenge.name}
                  </option>
                ))}
              </select>
            </label>
            <Button size="md" type="submit">
              Inscrever
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-3 rounded-[var(--radius-card)] border border-danger/25 bg-danger-wash p-4">
        <h2 className="text-sm font-semibold text-danger">Zona de risco</h2>
        <p className="text-xs leading-5 text-muted">
          Excluir remove definitivamente a conta, inscrições, progresso e histórico. Não pode ser desfeita.
        </p>
        <Button disabled={isSelf} onClick={() => setDeleteOpen(true)} type="button" variant="danger">
          Excluir usuário
        </Button>
        {isSelf ? <p className="text-xs leading-5 text-muted-2">Você não pode excluir a própria conta.</p> : null}
      </section>

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
    </div>
  );
}
