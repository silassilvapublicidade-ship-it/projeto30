"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminUser } from "@/server/services/admin-session.service";
import { recordSystemError } from "@/server/services/system-observability.service";
import {
  cleanupOrphanFiles,
  runStorageAudit,
  type StorageAuditRunResult,
} from "@/server/services/storage-audit.service";
import { isStorageBucketId, ORPHAN_CLEANUP_CONFIRMATION_PHRASE } from "@/features/admin/storage-audit.core";

export type StorageAuditActionResult =
  | { ok: true; result: StorageAuditRunResult }
  | { ok: false; message: string };

/**
 * Somente leitura (Parte A.5 - "nunca excluir nada durante a auditoria
 * inicial"). Qualquer admin pode acionar - a limpeza (destrutiva) é que
 * exige super_admin, verificado separadamente abaixo.
 */
export async function runStorageAuditAction(): Promise<StorageAuditActionResult> {
  const admin = await requireAdminUser();
  const supabase = await createSupabaseServerClient();

  await supabase.rpc("record_analytics_event", { p_event_name: "storage_audit_started", p_source: "server" });

  try {
    const result = await runStorageAudit(admin.id);
    await supabase.rpc("record_analytics_event", {
      p_event_name: "storage_audit_completed",
      p_metadata: {
        totalObjects: result.totalObjects,
        orphanCount: result.orphanCount,
        missingReferenceCount: result.missingReferenceCount,
        suspiciousCount: result.suspiciousCount,
        durationMs: result.durationMs,
      },
      p_source: "server",
    });
    revalidatePath("/admin/observabilidade/storage");
    return { ok: true, result };
  } catch (error) {
    await recordSystemError({
      area: "admin",
      operation: "storage_audit_run",
      severity: "error",
      message: error instanceof Error ? error.message : "Falha desconhecida na auditoria de Storage.",
      userId: admin.id,
    });
    return { ok: false, message: "Não foi possível concluir a auditoria de Storage agora. Tente novamente." };
  }
}

export type OrphanCleanupActionResult =
  | { ok: true; deletedCount: number; freedBytes: number; skippedCount: number }
  | { ok: false; message: string };

export async function cleanupOrphanFilesAction(input: {
  bucket: string;
  paths: string[];
  confirmationPhrase: string;
}): Promise<OrphanCleanupActionResult> {
  const admin = await requireAdminUser();

  if (admin.role !== "super_admin") {
    return { ok: false, message: "Apenas super administradores podem limpar arquivos órfãos." };
  }

  if (input.confirmationPhrase.trim() !== ORPHAN_CLEANUP_CONFIRMATION_PHRASE) {
    return { ok: false, message: `Digite exatamente "${ORPHAN_CLEANUP_CONFIRMATION_PHRASE}" para confirmar.` };
  }

  if (!isStorageBucketId(input.bucket)) {
    return { ok: false, message: "Bucket não permitido." };
  }

  if (input.paths.length === 0) {
    return { ok: false, message: "Selecione ao menos um arquivo." };
  }

  const supabase = await createSupabaseServerClient();

  try {
    const result = await cleanupOrphanFiles({ bucket: input.bucket, paths: input.paths });
    await supabase.rpc("record_analytics_event", {
      p_event_name: "storage_cleanup_completed",
      p_metadata: {
        bucket: input.bucket,
        deletedCount: result.deletedCount,
        freedBytes: result.freedBytes,
        skippedCount: result.skipped.length,
      },
      p_source: "server",
    });
    revalidatePath("/admin/observabilidade/storage");
    return {
      ok: true,
      deletedCount: result.deletedCount,
      freedBytes: result.freedBytes,
      skippedCount: result.skipped.length,
    };
  } catch (error) {
    await recordSystemError({
      area: "admin",
      operation: "storage_cleanup_run",
      severity: "error",
      message: error instanceof Error ? error.message : "Falha desconhecida na limpeza de Storage.",
      userId: admin.id,
    });
    return { ok: false, message: "Não foi possível concluir a limpeza agora. Tente novamente." };
  }
}
