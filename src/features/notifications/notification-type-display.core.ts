export type NotificationTypeIconKey =
  | "achievement"
  | "bell"
  | "campaign"
  | "challenge"
  | "habit"
  | "motivation"
  | "reminder"
  | "tip";

export type NotificationTypeDisplay = {
  categoryLabel: string;
  icon: NotificationTypeIconKey;
};

/**
 * Modulo G, Parte 10: toda notificacao enviada precisa aparecer na Central
 * com icone e categoria proprios, nunca so um sino generico - o `type` de
 * cada linha ja e o automation_type (automacoes) ou "campaign" (campanhas
 * manuais do admin), gravado em notification-dispatch.service.ts. Este mapa
 * so traduz esse valor ja existente para exibicao; nenhum dado novo.
 */
const NOTIFICATION_TYPE_DISPLAY: Record<string, NotificationTypeDisplay> = {
  achievement_unlocked: { categoryLabel: "Conquista", icon: "achievement" },
  campaign: { categoryLabel: "Comunicado", icon: "campaign" },
  challenge_ending_soon: { categoryLabel: "Desafio", icon: "challenge" },
  challenge_starting_today: { categoryLabel: "Desafio", icon: "challenge" },
  challenge_starting_tomorrow: { categoryLabel: "Desafio", icon: "challenge" },
  daily_motivation: { categoryLabel: "Motivação", icon: "motivation" },
  daily_reminder: { categoryLabel: "Lembrete", icon: "reminder" },
  habit_reminder: { categoryLabel: "Hábito", icon: "habit" },
  new_tip_published: { categoryLabel: "Dica", icon: "tip" },
  user_inactive_3_days: { categoryLabel: "Motivação", icon: "motivation" },
};

export function getNotificationTypeDisplay(type: string): NotificationTypeDisplay {
  return NOTIFICATION_TYPE_DISPLAY[type] ?? { categoryLabel: "Aviso", icon: "bell" };
}
