"use client";

import { useState } from "react";

import { AchievementDeleteDialog } from "@/components/admin/achievement-delete-dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type AchievementRowActionsProps = {
  achievementId: string;
  achievementName: string;
};

export function AchievementRowActions({ achievementId, achievementName }: AchievementRowActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu label={`Ações para ${achievementName}`}>
        {({ close }) => (
          <>
            <DropdownMenuItem href={`/admin/conquistas/${achievementId}/editar`}>Editar</DropdownMenuItem>
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

      <AchievementDeleteDialog
        achievementId={achievementId}
        achievementName={achievementName}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
}
