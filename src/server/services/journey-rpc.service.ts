import "server-only";

export { getSafeJourneyErrorMessage } from "@/features/journey/journey-rpc-error.core";

type RpcError = {
  code?: string;
  message: string;
};

type RpcResult<T> = {
  data: T | null;
  error: RpcError | null;
};

type SupabaseRpcClient = {
  rpc<T = unknown>(
    functionName: string,
    args?: Record<string, unknown>,
  ): Promise<RpcResult<T>>;
};

export function getJourneyRpcClient(client: unknown) {
  return client as SupabaseRpcClient;
}
