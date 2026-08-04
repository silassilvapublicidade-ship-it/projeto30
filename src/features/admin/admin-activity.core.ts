/**
 * Traduz os action codes crus de admin_audit_logs (ex.: "admin_pause_challenge")
 * para um rótulo humano, usado só na "Atividade recente" do cockpit. Ações
 * não mapeadas caem num fallback que só troca "_" por espaço e capitaliza -
 * nunca esconde uma ação real por falta de mapeamento.
 */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  admin_create_user: "Usuário criado",
  admin_delete_user: "Usuário removido",
  admin_reset_user_password: "Senha redefinida",
  admin_update_user_role: "Papel de usuário alterado",
  admin_update_user_status: "Status de usuário alterado",
  admin_pause_challenge: "Desafio pausado",
  admin_resume_challenge: "Desafio retomado",
  admin_end_challenge: "Desafio encerrado",
  admin_generate_challenge_days: "Dias do desafio gerados",
  admin_delete_test_challenge_permanently: "Desafio de teste removido",
  admin_duplicate_notification_campaign: "Campanha duplicada",
  admin_resolve_system_error_event: "Ocorrência atualizada",
  admin_update_challenge_day_message: "Mensagem do dia atualizada",
  admin_copy_challenge_day_message: "Mensagens do dia copiadas",
};

export function describeAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/^admin_/, "").replace(/_/g, " ").trim();
}

const ACTIVITY_CATEGORY_LABELS: Record<string, string> = {
  admin: "Admin",
  notificacoes: "Notificações",
  observabilidade: "Observabilidade",
};

export function describeActivityCategory(category: string): string {
  return ACTIVITY_CATEGORY_LABELS[category] ?? category;
}

export const COCKPIT_PERIODS = ["today", "24h", "7d"] as const;
export type CockpitPeriod = (typeof COCKPIT_PERIODS)[number];

export const COCKPIT_PERIOD_LABELS: Record<CockpitPeriod, string> = {
  today: "Hoje",
  "24h": "Últimas 24 horas",
  "7d": "Últimos 7 dias",
};

export function isCockpitPeriod(value: string): value is CockpitPeriod {
  return (COCKPIT_PERIODS as readonly string[]).includes(value);
}
