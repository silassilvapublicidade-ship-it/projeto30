"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusCard } from "@/components/ui/feedback";
import {
  resetUserPasswordAction,
  type ResetPasswordActionResult,
} from "@/features/admin/admin-users.actions";

const initialState: ResetPasswordActionResult = { message: "", ok: false };

function GenerateButton() {
  const { pending } = useFormStatus();

  return (
    <Button loading={pending} type="submit" variant="danger">
      Gerar senha temporária
    </Button>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-white/[0.08] text-muted transition-colors hover:border-action/40 hover:text-foreground focus-visible:outline-action-soft"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      type="button"
    >
      {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
      <span className="sr-only">Copiar senha temporária</span>
    </button>
  );
}

function ResetPasswordDialogContent({
  onOpenChange,
  titleId,
  userEmail,
  userId,
}: {
  onOpenChange: (open: boolean) => void;
  titleId: string;
  userEmail: string;
  userId: string;
}) {
  const [state, formAction] = useActionState(resetUserPasswordAction, initialState);

  if (state.ok) {
    return (
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground" id={titleId}>
          Senha temporária gerada
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Compartilhe com {userEmail} com segurança. Ela não será exibida novamente e a conta
          exigirá a troca no próximo acesso.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 truncate rounded-[var(--radius-control)] border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-sm text-foreground">
            {state.temporaryPassword}
          </code>
          <CopyButton value={state.temporaryPassword} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => onOpenChange(false)} type="button">
            Concluído
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="p-5 sm:p-6">
      <input name="userId" type="hidden" value={userId} />
      <h2 className="text-base font-semibold text-foreground" id={titleId}>
        Redefinir senha?
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Uma nova senha temporária será gerada para {userEmail}. A conta exigirá a troca dessa
        senha no próximo acesso.
      </p>
      {!state.ok && state.message ? (
        <div className="mt-4">
          <StatusCard description={state.message} title="Não foi possível concluir" tone="error" />
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button onClick={() => onOpenChange(false)} type="button" variant="ghost">
          Cancelar
        </Button>
        <GenerateButton />
      </div>
    </form>
  );
}

export function ResetPasswordButton({ userEmail, userId }: { userEmail: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [instanceKey, setInstanceKey] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closeAndReset(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      // Forces the inner useActionState to remount fresh next time it
      // opens, instead of reusing a stale "already generated" result.
      setInstanceKey((value) => value + 1);
    }
  }

  return (
    <>
      <button
        aria-label={`Redefinir senha de ${userEmail}`}
        className="flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-white/[0.08] text-muted transition-colors hover:border-action/40 hover:bg-action/10 hover:text-foreground focus-visible:outline-action-soft"
        onClick={() => setOpen(true)}
        type="button"
      >
        <KeyRound aria-hidden="true" size={15} />
      </button>

      <dialog
        aria-labelledby={titleId}
        className="m-auto max-w-sm rounded-[var(--radius-card)] border border-white/[0.10] bg-matte/96 p-0 text-foreground shadow-[var(--shadow-lift)] backdrop:bg-black/60"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeAndReset(false);
          }
        }}
        onClose={() => closeAndReset(false)}
        ref={dialogRef}
      >
        <ResetPasswordDialogContent
          key={instanceKey}
          onOpenChange={closeAndReset}
          titleId={titleId}
          userEmail={userEmail}
          userId={userId}
        />
      </dialog>
    </>
  );
}
