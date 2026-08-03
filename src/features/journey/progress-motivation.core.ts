/**
 * Progress-percent motivational copy (Parte D/17) - never the dominant
 * title, always secondary to points/habits realized. Bounds match the
 * brief's own table; adjust here only, never inline where it's used.
 */
export function resolveProgressMotivationalMessage(completionPercent: number): string {
  if (completionPercent <= 0) {
    return "Todo progresso começa com uma escolha.";
  }
  if (completionPercent < 26) {
    return "Você começou. Continue avançando.";
  }
  if (completionPercent < 50) {
    return "Cada ação conta.";
  }
  if (completionPercent < 70) {
    return "Você já fez muito hoje.";
  }
  if (completionPercent < 90) {
    return "Um dia consistente está sendo construído.";
  }
  if (completionPercent < 100) {
    return "Você está muito perto de completar o dia.";
  }
  return "Dia completo. Excelente trabalho.";
}

/**
 * challenge_days.message with a documented fallback - reused by the Hoje
 * header and the finalize celebration so the copy never lives twice.
 */
export function resolveDailyChallengeMessage(message: string | null | undefined): string {
  return message?.trim() ? message : "Você foi um pouco melhor hoje. Amanhã, continue.";
}
