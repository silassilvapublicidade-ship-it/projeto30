-- Parte E - fecha o ciclo de resposta do Feedback com notificacao. O motor
-- de notificacoes (0041+) e reaproveitado integralmente (mesma tabela
-- notification_campaigns, mesmo automation_resolve_specific_users_audience
-- ja usado por runAchievementUnlockedAutomation) - so falta 'feedback' no
-- allowlist de destination_type, mesmo padrao aditivo ja usado quando as
-- outras entradas foram acrescentadas.
alter table public.notifications
  drop constraint if exists notifications_destination_type_check;
alter table public.notifications
  add constraint notifications_destination_type_check check (
    destination_type is null or destination_type in (
      'hoje', 'desafios', 'desafio', 'jornada', 'dicas', 'dica',
      'conquistas', 'notificacoes', 'configuracoes_notificacoes', 'feedback'
    )
  );

alter table public.notification_campaigns
  drop constraint if exists notification_campaigns_destination_type_check;
alter table public.notification_campaigns
  add constraint notification_campaigns_destination_type_check check (
    destination_type in (
      'hoje', 'desafios', 'desafio', 'jornada', 'dicas', 'dica',
      'conquistas', 'notificacoes', 'configuracoes_notificacoes', 'feedback'
    )
  );
