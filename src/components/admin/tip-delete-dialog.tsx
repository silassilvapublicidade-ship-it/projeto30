"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteTipAction } from "@/features/admin/admin-tips.actions";

type TipDeleteDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  redirectTo: string;
  tipId: string;
  tipTitle: string;
};

/**
 * Real modal (not window.confirm): required exact warning text, a genuine
 * Cancelar/Confirmar dialog, and a disabled-while-pending submit button
 * (via ConfirmDialog's built-in useFormStatus loading state) guarding
 * against a double-click double-submitting the delete.
 */
export function TipDeleteDialog({ onOpenChange, open, redirectTo, tipId, tipTitle }: TipDeleteDialogProps) {
  return (
    <ConfirmDialog
      confirmLabel="Excluir definitivamente"
      description={`Esta ação excluirá definitivamente este card de dica. Isso remove o registro e a imagem, e não pode ser desfeita. Confirma a exclusão de "${tipTitle}"?`}
      formAction={deleteTipAction}
      hiddenFields={{ redirectTo, tipId }}
      onOpenChange={onOpenChange}
      open={open}
      title="Excluir card de dica?"
    />
  );
}
