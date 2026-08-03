-- Modulo F, Rodada F2: audience_type extra para campanhas de automacao.
--
-- As 6 automacoes (lembrete diario, desafio comeca amanha/hoje, dica
-- publicada, conquista desbloqueada, desafio termina em 3 dias, usuario
-- inativo ha 3 dias) resolvem seu proprio publico com uma consulta de
-- regra de negocio (ex.: "enrollments cujo challenge.start_date = amanha"),
-- nunca atraves de resolve_notification_audience (que so cobre segmentacao
-- generica do compositor admin) - ver dispatchCampaignToAudience em
-- notification-dispatch.service.ts, que recebe a lista de destinatarios ja
-- pronta. Esses valores de audience_type existem so para o campo ficar
-- legivel no /admin/notificacoes (nunca sao passados de volta para
-- resolve_notification_audience).

alter table public.notification_campaigns
  drop constraint if exists notification_campaigns_audience_type_check;
alter table public.notification_campaigns
  add constraint notification_campaigns_audience_type_check check (
    audience_type in (
      'all_active_users', 'specific_user', 'challenge_participants',
      'active_enrollment', 'day_not_finalized', 'day_finalized',
      'push_enabled', 'push_disabled_internal_only', 'admins', 'super_admins',
      'automation_daily_reminder', 'automation_challenge_starting_tomorrow',
      'automation_challenge_starting_today', 'automation_challenge_ending_soon',
      'automation_new_tip', 'automation_achievement_unlocked',
      'automation_inactive_user'
    )
  );
