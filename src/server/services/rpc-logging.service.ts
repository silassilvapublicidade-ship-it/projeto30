import "server-only";

/**
 * Same pattern as journey.actions.ts's local logJourneyRpcFailure (kept
 * there unexported since only that file used it) - shared here because
 * the notifications feature adds several new Server Action files that all
 * need the same "log the Postgres error code/message server-side, never
 * the row payload" behavior.
 */
export function logRpcFailure(rpcName: string, error: { code?: string; message: string }) {
  console.error(`[rpc-failed] ${rpcName} code=${error.code ?? "unknown"}: ${error.message}`);
}
