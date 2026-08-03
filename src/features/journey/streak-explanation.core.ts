export type StreakOutcome = {
  /** Whether TODAY's completion met the streak minimum - never confused
   * with streakCurrent > 0, which can be true from an earlier day while
   * today itself still broke the chain. */
  metMinimum: boolean;
  message: string;
};

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
}

/**
 * The single source of the streak explanation copy - reused by the
 * finalize celebration, the inline finalize summary (on revisit) and the
 * Hoje progress card, so the wording never drifts between the three. Root
 * cause of the reported "sequência em 0 sem explicação" bug: the RPC never
 * surfaced streak_minimum_completion, so there was nothing to explain WITH
 * - not a calculation defect (see migration 0049's own comment).
 */
export function describeStreakOutcome({
  completionPercent,
  streakCurrent,
  streakMinimumCompletion,
}: {
  completionPercent: number;
  streakCurrent: number;
  streakMinimumCompletion: number;
}): StreakOutcome {
  const metMinimum = completionPercent >= streakMinimumCompletion;

  if (metMinimum) {
    return {
      message:
        streakCurrent > 0
          ? `Sequência mantida: ${streakCurrent} ${streakCurrent === 1 ? "dia" : "dias"}.`
          : "Dia concluído dentro da meta de hoje.",
      metMinimum: true,
    };
  }

  return {
    message: `Você concluiu ${formatPercent(completionPercent)} dos hábitos diários. A sequência exige ${formatPercent(streakMinimumCompletion)}, por isso ela não avançou hoje.`,
    metMinimum: false,
  };
}
