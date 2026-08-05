"use server";

import { isSystemErrorArea } from "@/features/observability/system-error.core";
import { getOptionalAuthUser } from "@/server/services/auth-session.service";
import { recordSystemError } from "@/server/services/system-observability.service";

/**
 * O único ponto de entrada client -> Observabilidade (Parte L: "registrar
 * apenas erros importantes via Server Action... nunca todo console.error
 * transformado em evento"). Só é chamado pelos dois error.tsx (admin e
 * área de membros) - nunca por código de produto comum. A severidade é
 * SEMPRE "warning" aqui, nunca escolhida pelo cliente: um error boundary
 * já significa que a página se recuperou (mostrou uma tela de erro em vez
 * de travar), então nunca é CRITICAL por definição.
 */
export async function reportClientErrorAction(input: {
  area: string;
  route: string;
  digest?: string | undefined;
  message: string;
}): Promise<{ errorCode: string | null }> {
  const area = isSystemErrorArea(input.area) ? input.area : "app";
  const user = await getOptionalAuthUser().catch(() => null);

  return recordSystemError({
    area,
    operation: "client_error_boundary",
    severity: "warning",
    message: input.message,
    route: input.route,
    metadata: input.digest ? { digest: input.digest } : {},
    userId: user?.id,
  });
}
