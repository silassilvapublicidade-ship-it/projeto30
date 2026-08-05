import "server-only";

import { getServerEnv } from "@/lib/env/server";

/**
 * Abstração fina sobre o provedor de IA (Parte 19) - nada no resto do
 * código chama a Anthropic API diretamente; tudo passa por
 * `generateWithAiProvider`. Trocar de provedor no futuro (ou suportar mais
 * de um) significa mudar só este arquivo, nunca os chamadores. Chave lida
 * exclusivamente aqui, nunca em código client - `getServerEnv()` já é
 * `server-only`.
 */

const DEFAULT_MODEL = "claude-sonnet-5";
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 2;
const ANTHROPIC_API_VERSION = "2023-06-01";

export type AiGenerationRequest = {
  system: string;
  prompt: string;
  maxOutputTokens?: number;
};

export type AiGenerationResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: "not_configured" | "timeout" | "provider_error"; message: string };

export function isAiProviderConfigured(): boolean {
  return Boolean(getServerEnv().ANTHROPIC_API_KEY);
}

export async function generateWithAiProvider(request: AiGenerationRequest): Promise<AiGenerationResult> {
  const env = getServerEnv();

  if (!env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Nenhum provedor de IA está configurado (ANTHROPIC_API_KEY ausente).",
    };
  }

  const model = env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  let lastFailure: { timedOut: boolean } = { timedOut: false };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        body: JSON.stringify({
          max_tokens: request.maxOutputTokens ?? 4000,
          messages: [{ content: request.prompt, role: "user" }],
          model,
          system: request.system,
        }),
        headers: {
          "anthropic-version": ANTHROPIC_API_VERSION,
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
        },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        lastFailure = { timedOut: false };
        continue;
      }

      const payload = (await response.json()) as { content?: Array<{ text?: string; type: string }> };
      const text = payload.content?.find((block) => block.type === "text")?.text;

      if (!text) {
        lastFailure = { timedOut: false };
        continue;
      }

      return { model, ok: true, text };
    } catch (error) {
      lastFailure = { timedOut: error instanceof Error && error.name === "AbortError" };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return {
    message: lastFailure.timedOut
      ? "O provedor de IA não respondeu a tempo. Tente novamente."
      : "Não foi possível gerar o conteúdo agora. Tente novamente.",
    ok: false,
    reason: lastFailure.timedOut ? "timeout" : "provider_error",
  };
}
