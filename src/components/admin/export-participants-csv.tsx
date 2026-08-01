"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExportParticipantsCsvProps = {
  canIncludePersonalData: boolean;
  exportBaseHref: string;
};

/**
 * The default export never carries name/e-mail (brief: "sem e-mail por
 * padrão"). Only a super_admin sees the second control, and clicking it
 * still requires an explicit confirm() before the personal-data URL is
 * requested - a plain "?p=1" link a super_admin could paste/bookmark without
 * this extra step is deliberately not exposed anywhere in the UI.
 */
export function ExportParticipantsCsv({
  canIncludePersonalData,
  exportBaseHref,
}: ExportParticipantsCsvProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        as="a"
        href={exportBaseHref}
        leadingIcon={<Download aria-hidden="true" size={15} />}
        variant="secondary"
      >
        Exportar CSV
      </Button>
      {canIncludePersonalData ? (
        <Button
          leadingIcon={<Download aria-hidden="true" size={15} />}
          onClick={() => {
            const confirmed = window.confirm(
              "Este arquivo incluirá nome e e-mail dos participantes filtrados. Confirma o download?",
            );

            if (confirmed) {
              const separator = exportBaseHref.includes("?") ? "&" : "?";
              window.location.href = `${exportBaseHref}${separator}p=1&confirm=1`;
            }
          }}
          type="button"
          variant="ghost"
        >
          Exportar com dados pessoais
        </Button>
      ) : null}
    </div>
  );
}
