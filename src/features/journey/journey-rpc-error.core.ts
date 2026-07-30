export type JourneyRpcError = {
  code?: string;
  message: string;
};

export function getSafeJourneyErrorMessage(error: JourneyRpcError | null | undefined) {
  if (!error) {
    return "Nao foi possivel concluir a acao agora.";
  }

  if (error.code === "42501") {
    return "Sua sessao precisa ser renovada antes de continuar.";
  }

  if (error.code === "P0002") {
    return "Nao encontramos um ciclo disponivel para esta acao.";
  }

  if (error.code === "P0003") {
    return "Conclua todos os habitos essenciais do dia antes de finalizar.";
  }

  if (error.code === "P0005") {
    return "Este desafio ainda nao comecou oficialmente.";
  }

  if (error.code === "22023") {
    return "Este dia nao aceita essa alteracao agora.";
  }

  return "Nao foi possivel salvar agora. Tente novamente em instantes.";
}
