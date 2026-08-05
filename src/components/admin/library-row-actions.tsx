"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { transitionLibraryContentStatusAction } from "@/features/admin/admin-library.actions";
import type { LibraryContentStatus } from "@/features/library/library.core";

function TransitionForm({
  contentId,
  label,
  redirectTo,
  status,
}: {
  contentId: string;
  label: string;
  redirectTo: string;
  status: LibraryContentStatus;
}) {
  return (
    <form action={transitionLibraryContentStatusAction}>
      <input name="contentId" type="hidden" value={contentId} />
      <input name="status" type="hidden" value={status} />
      <input name="redirectTo" type="hidden" value={redirectTo} />
      <button
        className="block w-full rounded-[0.4rem] px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/[0.06]"
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}

/**
 * As opções mudam conforme o status atual - a RPC já bloqueia published/
 * scheduled sem approved (Parte 13), mas o menu só oferece o que faz
 * sentido a partir de onde o conteúdo está agora, em vez de deixar o admin
 * clicar em algo que vai simplesmente falhar.
 */
export function LibraryRowActions({
  contentId,
  redirectTo,
  status,
}: {
  contentId: string;
  redirectTo: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);

  const options: Array<{ label: string; status: LibraryContentStatus }> = [];
  if (status !== "in_review") options.push({ label: "Enviar para revisão", status: "in_review" });
  if (status !== "approved") options.push({ label: "Aprovar", status: "approved" });
  if (status === "approved" || status === "scheduled") options.push({ label: "Publicar agora", status: "published" });
  if (status !== "draft") options.push({ label: "Voltar para rascunho", status: "draft" });
  if (status !== "archived") options.push({ label: "Arquivar", status: "archived" });

  return (
    <div className="relative inline-block text-left">
      <button
        aria-label="Mais ações"
        className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={16} />
      </button>
      {open ? (
        <>
          <button
            aria-hidden="true"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-[var(--radius-card)] border border-white/[0.1] bg-[var(--p30-black)] p-1 shadow-[var(--shadow-lift)]">
            {options.map((option) => (
              <TransitionForm
                contentId={contentId}
                key={option.status}
                label={option.label}
                redirectTo={redirectTo}
                status={option.status}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
