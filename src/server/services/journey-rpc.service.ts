import "server-only";

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

export function getSafeJourneyErrorMessage(error: RpcError | null | undefined) {
  if (!error) {
    return "Nao foi possivel concluir a acao agora.";
  }

  if (error.code === "42501") {
    return "Sua sessao precisa ser renovada antes de continuar.";
  }

  if (error.code === "P0002") {
    return "Nao encontramos um ciclo disponivel para esta acao.";
  }

  if (error.code === "22023") {
    return "Este dia nao aceita essa alteracao agora.";
  }

  return "Nao foi possivel salvar agora. Tente novamente em instantes.";
}
