"use client";

import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatLine } from "@/components/admin/stat-line";
import { Button } from "@/components/ui/button";
import { executeSystemErrorPurgeAction } from "@/features/admin/retention-purge.actions";
import { RETENTION_PURGE_CONFIRMATION_PHRASE } from "@/features/observability/system-error.core";
import { formatProjectDate } from "@/lib/format-date";
import type { SystemErrorPurgePreview } from "@/server/services/system-observability.service";

export function RetentionPurgePanel({
  isSuperAdmin,
  preview,
}: {
  isSuperAdmin: boolean;
  preview: SystemErrorPurgePreview;
}) {
  const [open, setOpen] = useState(false);
  const [typedPhrase, setTypedPhrase] = useState("");
  const inputId = useId();

  const severityEntries = Object.entries(preview.severityBreakdown);
  const areaEntries = Object.entries(preview.areaBreakdown);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-muted-2">
        Política atual: diagnósticos <strong className="text-foreground">resolvidos</strong> há mais de{" "}
        {preview.cutoffDays} dias podem ser removidos. Erros abertos nunca são afetados.
      </p>

      {preview.eligibleCount === 0 ? (
        <StatLine text="Não há diagnósticos antigos para remover." tone="positive" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <StatLine text={`${preview.eligibleCount} diagnóstico(s) elegível(is) para remoção`} tone="attention" />
          <StatLine
            text={`Período: ${formatProjectDate(preview.oldestResolvedAt)} até ${formatProjectDate(preview.newestResolvedAt)}`}
            tone="neutral"
          />
          {severityEntries.length > 0 ? (
            <StatLine
              text={`Severidade: ${severityEntries.map(([k, v]) => `${k} (${v})`).join(", ")}`}
              tone="neutral"
            />
          ) : null}
          {areaEntries.length > 0 ? (
            <StatLine text={`Áreas: ${areaEntries.map(([k, v]) => `${k} (${v})`).join(", ")}`} tone="neutral" />
          ) : null}
        </div>
      )}

      {isSuperAdmin && preview.eligibleCount > 0 ? (
        <Button onClick={() => setOpen(true)} size="sm" variant="danger">
          Executar limpeza
        </Button>
      ) : null}

      <ConfirmDialog
        confirmDisabled={typedPhrase !== RETENTION_PURGE_CONFIRMATION_PHRASE}
        confirmLabel="Confirmar limpeza"
        description={`Somente diagnósticos resolvidos há mais de ${preview.cutoffDays} dias serão removidos. Erros abertos não serão alterados.`}
        formAction={executeSystemErrorPurgeAction}
        hiddenFields={{ confirmationPhrase: typedPhrase }}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setTypedPhrase("");
        }}
        open={open}
        title="Limpar diagnósticos antigos?"
      >
        <div className="mt-4">
          <label className="text-xs font-medium text-muted" htmlFor={inputId}>
            Digite a frase exata: &ldquo;{RETENTION_PURGE_CONFIRMATION_PHRASE}&rdquo;
          </label>
          <input
            autoComplete="off"
            className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
            id={inputId}
            onChange={(event) => setTypedPhrase(event.target.value)}
            placeholder={RETENTION_PURGE_CONFIRMATION_PHRASE}
            spellCheck={false}
            type="text"
            value={typedPhrase}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
