import "server-only";

import { mapPostgresCodeToSeverity } from "@/features/observability/system-error.core";

import { recordSystemError } from "./system-observability.service";

/**
 * Same pattern as journey.actions.ts's local logJourneyRpcFailure (kept
 * there unexported since only that file used it) - shared here because
 * the notifications feature adds several new Server Action files that all
 * need the same "log the Postgres error code/message server-side, never
 * the row payload" behavior. Also persists a system_error_event (area
 * "notificacoes") so every call site here shows up in the Observabilidade
 * panel for free.
 */
export function logRpcFailure(rpcName: string, error: { code?: string; message: string }) {
  console.error(`[rpc-failed] ${rpcName} code=${error.code ?? "unknown"}: ${error.message}`);

  void recordSystemError({
    area: "notificacoes",
    operation: rpcName,
    severity: mapPostgresCodeToSeverity(error.code),
    message: `Falha em ${rpcName}.`,
    postgresCode: error.code,
  });
}
