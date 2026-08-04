export type MonthlyCycleSummary = {
  status: "current" | "upcoming";
  month: string;
  theme: string;
  description: string;
};

/**
 * Resumo público do ciclo do mês para a seção "Uma nova jornada a cada mês"
 * da home. Editorial, não vem do banco: o headline/tagline reais do ciclo
 * (theme_config) seguem podendo ser mais intensos para quem já está
 * inscrito - aqui é só a vitrine pública, sempre no tom institucional.
 */
export const CURRENT_MONTHLY_CYCLE: MonthlyCycleSummary = {
  status: "current",
  month: "Agosto",
  theme: "Disciplina",
  description: "Construa hábitos e prove a força da constância.",
};

export const NEXT_MONTHLY_CYCLE: MonthlyCycleSummary = {
  status: "upcoming",
  month: "Próximo ciclo",
  theme: "Em breve",
  description: "Um novo tema chega no início do próximo mês.",
};
