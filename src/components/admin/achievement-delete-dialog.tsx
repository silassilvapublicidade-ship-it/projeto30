"use client";

import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteAchievementAction,
  getAchievementDeletePreviewAction,
  type DeletePreviewResult,
} from "@/features/admin/admin-achievements.actions";

type AchievementDeleteDialogProps = {
  achievementId: string;
  achievementName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * Unlike TipDeleteDialog (nothing else references a tip card), an
 * achievement's FKs (user_achievements, share_cards) are ON DELETE CASCADE -
 * the database itself never blocks this delete. So this dialog fetches the
 * real unlocked_count from admin_achievement_delete_preview before the
 * confirm button is even enabled, and stays permanently disabled (no bypass
 * phrase, unlike the test-challenge purge) once any real user has unlocked
 * it - the only way to remove it from view at that point is to disable it.
 */
export function AchievementDeleteDialog({
  achievementId,
  achievementName,
  onOpenChange,
  open,
}: AchievementDeleteDialogProps) {
  const [preview, setPreview] = useState<DeletePreviewResult | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    getAchievementDeletePreviewAction(achievementId).then((result) => {
      if (!cancelled) {
        setPreview(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, achievementId]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPreview(null);
    }
    onOpenChange(next);
  }

  const canDelete = preview?.ok && preview.preview.can_delete;

  return (
    <ConfirmDialog
      confirmDisabled={!canDelete}
      confirmLabel="Excluir"
      description={`Esta ação excluirá definitivamente a conquista "${achievementName}". Isso não pode ser desfeito.`}
      formAction={deleteAchievementAction}
      hiddenFields={{ achievementId }}
      onOpenChange={handleOpenChange}
      open={open}
      title={`Excluir "${achievementName}"?`}
    >
      <div className="mt-4 rounded-[var(--radius-control)] border border-danger/25 bg-danger-wash p-3">
        {!preview ? (
          <p className="text-xs text-muted">Verificando se já foi desbloqueada...</p>
        ) : !preview.ok ? (
          <p className="text-xs text-danger">{preview.message}</p>
        ) : preview.preview.can_delete ? (
          <p className="text-xs text-muted">
            Nenhum usuário desbloqueou esta conquista ainda - pode ser excluída com segurança.
          </p>
        ) : (
          <p className="text-xs text-danger">
            {preview.preview.unlocked_count}{" "}
            {preview.preview.unlocked_count === 1 ? "usuário já desbloqueou" : "usuários já desbloquearam"} esta
            conquista. Não pode ser excluída - desative-a em vez disso.
          </p>
        )}
      </div>
    </ConfirmDialog>
  );
}
