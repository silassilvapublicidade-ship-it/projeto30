"use client";

import { useState, useTransition } from "react";

import { toggleShareTemplateActiveAction } from "@/features/admin/admin-share-templates.actions";
import { cn } from "@/lib/utils";

/** Ativar/desativar um template de compartilhamento (Parte E item 24) - otimista, reverte se o servidor recusar. */
export function ShareTemplateToggle({ active, templateId }: { active: boolean; templateId: string }) {
  const [isActive, setIsActive] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !isActive;
    setIsActive(next);
    setError(null);

    startTransition(async () => {
      const result = await toggleShareTemplateActiveAction(templateId, next);
      if (result.error) {
        setIsActive(!next);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        aria-pressed={isActive}
        className={cn(
          "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors disabled:opacity-60",
          isActive
            ? "border-success/28 bg-success-wash text-success"
            : "border-white/[0.08] bg-white/[0.03] text-muted hover:text-foreground",
        )}
        disabled={isPending}
        onClick={handleToggle}
        type="button"
      >
        {isActive ? "Ativo" : "Inativo"}
      </button>
      {error ? <p className="text-[0.65rem] text-danger">{error}</p> : null}
    </div>
  );
}
