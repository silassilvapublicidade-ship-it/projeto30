"use client";

import { useId, useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/feedback";
import { StatLine } from "@/components/admin/stat-line";
import {
  cleanupOrphanFilesAction,
  runStorageAuditAction,
} from "@/features/admin/storage-audit.actions";
import {
  ORPHAN_CLEANUP_CONFIRMATION_PHRASE,
  STORAGE_BUCKET_LABELS,
  type StorageBucketId,
} from "@/features/admin/storage-audit.core";
import { formatProjectDateTime } from "@/lib/format-date";
import type { StorageAuditRunResult } from "@/server/services/storage-audit.service";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

const statusLabel: Record<string, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  degradado: "Degradado",
  critico: "Crítico",
};

const statusTone: Record<string, "success" | "accent" | "warning" | "danger"> = {
  saudavel: "success",
  atencao: "accent",
  degradado: "warning",
  critico: "danger",
};

function CleanupDialog({
  bucket,
  onOpenChange,
  onResult,
  open,
  paths,
}: {
  bucket: StorageBucketId;
  onOpenChange: (open: boolean) => void;
  onResult: (message: string, ok: boolean) => void;
  open: boolean;
  paths: string[];
}) {
  const [typedPhrase, setTypedPhrase] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputId = useId();

  function handleSubmit(formData: FormData) {
    const phrase = String(formData.get("confirmationPhrase") ?? "");
    startTransition(async () => {
      const result = await cleanupOrphanFilesAction({ bucket, paths, confirmationPhrase: phrase });
      if (result.ok) {
        onResult(
          `${result.deletedCount} arquivo(s) removido(s) (${result.skippedCount} ignorado(s) por já não serem mais órfãos).`,
          true,
        );
        onOpenChange(false);
      } else {
        onResult(result.message, false);
      }
      setTypedPhrase("");
    });
  }

  return (
    <ConfirmDialog
      confirmDisabled={typedPhrase !== ORPHAN_CLEANUP_CONFIRMATION_PHRASE || isPending}
      confirmLabel={isPending ? "Excluindo…" : "Excluir arquivos"}
      description={`${paths.length} arquivo(s) selecionado(s) em "${STORAGE_BUCKET_LABELS[bucket]}" serão revalidados e, se ainda órfãos, excluídos permanentemente. Esta ação não pode ser desfeita.`}
      formAction={handleSubmit}
      onOpenChange={onOpenChange}
      open={open}
      title="Excluir arquivos órfãos?"
    >
      <div className="mt-4">
        <label className="text-xs font-medium text-muted" htmlFor={inputId}>
          Digite a frase exata: &ldquo;{ORPHAN_CLEANUP_CONFIRMATION_PHRASE}&rdquo;
        </label>
        <input
          autoComplete="off"
          className="mt-1.5 w-full rounded-[var(--radius-control)] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus-visible:outline-action-soft"
          id={inputId}
          onChange={(event) => setTypedPhrase(event.target.value)}
          placeholder={ORPHAN_CLEANUP_CONFIRMATION_PHRASE}
          spellCheck={false}
          type="text"
          value={typedPhrase}
        />
      </div>
    </ConfirmDialog>
  );
}

export function StorageAuditPanel({ canCleanup }: { canCleanup: boolean }) {
  const [result, setResult] = useState<StorageAuditRunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [cleanupTarget, setCleanupTarget] = useState<StorageBucketId | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);

  const selectedByBucket = useMemo(() => {
    const map = new Map<StorageBucketId, string[]>();
    if (!result) return map;
    for (const bucketResult of result.buckets) {
      const paths = bucketResult.findings
        .filter((f) => f.classification === "orphan" && selected[`${f.bucket}:${f.path}`])
        .map((f) => f.path);
      if (paths.length > 0) map.set(bucketResult.summary.bucket, paths);
    }
    return map;
  }, [result, selected]);

  async function handleRunAudit() {
    setIsRunning(true);
    setRunError(null);
    setFeedback(null);
    const response = await runStorageAuditAction();
    setIsRunning(false);
    if (response.ok) {
      setResult(response.result);
      setSelected({});
    } else {
      setRunError(response.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={isRunning} onClick={handleRunAudit} type="button">
          Executar auditoria de Storage
        </Button>
        {result ? (
          <span className="text-xs text-muted-2">
            Concluída em {formatProjectDateTime(result.finishedAt)} · {(result.durationMs / 1000).toFixed(1)}s
          </span>
        ) : null}
      </div>

      {runError ? (
        <div className="rounded-[var(--radius-card)] border border-danger/25 bg-danger-wash p-3 text-sm text-danger">
          {runError}
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`rounded-[var(--radius-card)] border p-3 text-sm ${feedback.ok ? "border-success/25 bg-success-wash text-success" : "border-danger/25 bg-danger-wash text-danger"}`}
        >
          {feedback.message}
        </div>
      ) : null}

      {!result ? (
        <EmptyState
          description="Execute a auditoria para ver buckets, objetos, órfãos e referências ausentes em tempo real."
          title="Nenhuma auditoria carregada"
        />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Status geral</p>
              <Badge className="mt-2" tone={statusTone[result.status] ?? "neutral"}>
                {statusLabel[result.status]}
              </Badge>
            </div>
            <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Objetos / tamanho</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{result.totalObjects}</p>
              <p className="text-xs text-muted-2">{formatBytes(result.totalBytes)}</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Órfãos</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{result.orphanCount}</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-2">Referências ausentes</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{result.missingReferenceCount}</p>
            </div>
          </section>

          <div className="space-y-4">
            {result.buckets.map((bucketResult) => {
              const bucket = bucketResult.summary.bucket;
              const orphanFindings = bucketResult.findings.filter((f) => f.classification === "orphan");
              const otherFindings = bucketResult.findings.filter((f) => f.classification !== "orphan");
              const selectedPaths = selectedByBucket.get(bucket) ?? [];

              return (
                <section className="rounded-[var(--radius-card)] border border-white/[0.08] bg-white/[0.03] p-4" key={bucket}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{STORAGE_BUCKET_LABELS[bucket]}</h3>
                    <span className="text-xs text-muted-2">
                      {bucketResult.summary.totalObjects} objeto(s) · {formatBytes(bucketResult.summary.totalBytes)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-2">{bucketResult.summary.recommendedAction}</p>

                  {bucketResult.findings.length === 0 ? (
                    <StatLine text="Nenhum achado neste bucket." tone="positive" />
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {[...otherFindings, ...orphanFindings].map((finding) => {
                        const key = `${finding.bucket}:${finding.path}`;
                        return (
                          <li
                            className="flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs"
                            key={key}
                          >
                            {finding.classification === "orphan" && canCleanup ? (
                              <input
                                aria-label={`Selecionar ${finding.path}`}
                                checked={Boolean(selected[key])}
                                className="mt-0.5"
                                onChange={(event) =>
                                  setSelected((prev) => ({ ...prev, [key]: event.target.checked }))
                                }
                                type="checkbox"
                              />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  tone={
                                    finding.classification === "missing_reference"
                                      ? "danger"
                                      : finding.classification === "suspicious"
                                        ? "warning"
                                        : "accent"
                                  }
                                >
                                  {finding.classification === "orphan"
                                    ? "Órfão"
                                    : finding.classification === "missing_reference"
                                      ? "Referência ausente"
                                      : "Suspeito"}
                                </Badge>
                                <span className="font-mono text-[0.65rem] text-muted-2">{finding.diagnosticCode}</span>
                              </div>
                              <p className="mt-1 break-all font-mono text-muted">{finding.path}</p>
                              <p className="mt-0.5 text-muted-2">{finding.reason}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canCleanup && selectedPaths.length > 0 ? (
                    <div className="mt-3">
                      <Button onClick={() => setCleanupTarget(bucket)} size="sm" variant="danger">
                        Limpar {selectedPaths.length} arquivo(s) órfão(s) selecionado(s)
                      </Button>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      )}

      {cleanupTarget ? (
        <CleanupDialog
          bucket={cleanupTarget}
          onOpenChange={(open) => {
            if (!open) setCleanupTarget(null);
          }}
          onResult={(message, ok) => setFeedback({ message, ok })}
          open={Boolean(cleanupTarget)}
          paths={selectedByBucket.get(cleanupTarget) ?? []}
        />
      ) : null}
    </div>
  );
}
