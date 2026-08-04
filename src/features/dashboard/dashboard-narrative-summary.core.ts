/**
 * "Resumo narrativo" (Refinamento premium, Parte D item 14) - um bloco
 * compacto que costura 3 numeros que ja existem em outros lugares do
 * Dashboard (dias finalizados, pontos, conquistas) em uma unica frase
 * legivel, sem repetir tudo que os cards de metricas ja mostram. A segunda
 * frase (contexto adicional) so aparece quando o dia de hoje ainda pode
 * avancar a sequencia - nunca uma promessa vaga sem numero real por tras.
 */
export type NarrativeSummaryInput = {
  achievementsUnlocked: number;
  daysFinalized: number;
  pointsTotal: number;
  streakCurrent: number;
  todayFinalized: boolean;
};

export type NarrativeSummary = {
  primary: string;
  secondary: string | null;
};

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildNarrativeSummary(input: NarrativeSummaryInput): NarrativeSummary {
  const primary =
    `Você já finalizou ${input.daysFinalized} ${pluralize(input.daysFinalized, "dia", "dias")}, ` +
    `conquistou ${input.pointsTotal} ${pluralize(input.pointsTotal, "ponto", "pontos")} e ` +
    `desbloqueou ${input.achievementsUnlocked} ${pluralize(input.achievementsUnlocked, "marco", "marcos")} neste ciclo.`;

  const secondary = input.todayFinalized
    ? null
    : `Hoje você pode avançar sua sequência para ${input.streakCurrent + 1} ${pluralize(input.streakCurrent + 1, "dia", "dias")}.`;

  return { primary, secondary };
}
