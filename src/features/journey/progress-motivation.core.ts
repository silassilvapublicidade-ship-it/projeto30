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

/**
 * Day-over-day comparison (auditoria de produto, item 03 - "hoje você fez
 * mais que ontem"). Only ever returns a positive-or-neutral message, never
 * a discouraging one: the day being compared against "today" isn't over
 * yet, so telling someone they're currently behind yesterday's FINAL result
 * would be premature and against this app's own tone rules (never
 * aggressive, always encouraging - see notification-automations.service.ts's
 * own tone principles). yesterdayPercent is null whenever there's nothing
 * real to compare against (no log yesterday, or it was never finalized) -
 * that case renders no message at all rather than a fabricated one.
 */
export function describeDayOverDayComparison({
  todayPercent,
  yesterdayPercent,
}: {
  todayPercent: number;
  yesterdayPercent: number | null;
}): string | null {
  if (yesterdayPercent === null) {
    return null;
  }

  if (todayPercent > yesterdayPercent) {
    return "Hoje você já fez mais que ontem.";
  }

  if (todayPercent === yesterdayPercent) {
    return "Hoje você está no mesmo ritmo de ontem.";
  }

  return null;
}
