-- Cockpit operacional do Admin (/admin). Reaproveita integralmente as
-- regras de saude ja definidas em 0072/0073
-- (admin_get_system_health_overview) - nunca uma segunda regra de status.
--
-- 1) admin_get_system_health_overview ganha 2 campos novos no jsonb
--    (openCriticalErrors24h, openErrors24h) - aditivo, nao quebra o painel
--    de Observabilidade, que ja ignora chaves desconhecidas.
-- 2) admin_operational_overview: UMA RPC agregada para toda a primeira
--    dobra do cockpit (metricas do periodo + blocos + saude + cron),
--    evitando N+1 no cliente.
-- 3) admin_recent_activity: RPC paginada separada (Parte K sugere as
--    duas), reaproveitando admin_audit_logs + notification_campaigns +
--    system_error_events - nenhuma tabela nova, nenhum dado sensivel
--    (nunca before_json/after_json, que podem conter e-mail).
-- 4) analytics_events ganha 'admin_overview_viewed' no whitelist.

create or replace function public.admin_get_system_health_overview()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_errors_24h integer;
  v_errors_7d integer;
  v_users_affected_24h integer;
  v_open_critical_24h integer;
  v_open_error_24h integer;
  v_max_occurrence_24h integer;
  v_campaigns_failed_24h integer;
  v_campaigns_partial_24h integer;
  v_deliveries_failed_24h integer;
  v_deliveries_pending integer;
  v_deliveries_retry integer;
  v_subscriptions_revoked_24h integer;
  v_subscriptions_active integer;
  v_cards_failed_24h integer;
  v_uploads_failed_24h integer;
  v_onboarding_stuck integer;
  v_last_cron jsonb;
  v_status text;
begin
  perform public.admin_require_admin();

  select count(*) filter (where last_seen_at >= now() - interval '24 hours'),
         count(*) filter (where last_seen_at >= now() - interval '7 days')
  into v_errors_24h, v_errors_7d
  from public.system_error_events;

  select count(distinct user_id) filter (where last_seen_at >= now() - interval '24 hours' and user_id is not null)
  into v_users_affected_24h
  from public.system_error_events;

  select count(*) filter (where severity = 'critical' and status <> 'resolved' and last_seen_at >= now() - interval '24 hours'),
         count(*) filter (where severity = 'error' and status <> 'resolved' and last_seen_at >= now() - interval '24 hours'),
         coalesce(max(occurrence_count) filter (where last_seen_at >= now() - interval '24 hours'), 0)
  into v_open_critical_24h, v_open_error_24h, v_max_occurrence_24h
  from public.system_error_events;

  select count(*) filter (where status = 'failed' and updated_at >= now() - interval '24 hours'),
         count(*) filter (where status = 'partially_failed' and updated_at >= now() - interval '24 hours')
  into v_campaigns_failed_24h, v_campaigns_partial_24h
  from public.notification_campaigns;

  select count(*) filter (where status = 'failed' and coalesce(failed_at, sent_at, scheduled_at) >= now() - interval '24 hours'),
         count(*) filter (where status = 'pending' and next_retry_at is null),
         count(*) filter (where status = 'pending' and next_retry_at is not null)
  into v_deliveries_failed_24h, v_deliveries_pending, v_deliveries_retry
  from public.notification_deliveries;

  select count(*) filter (where revoked_at >= now() - interval '24 hours'),
         count(*) filter (where revoked_at is null)
  into v_subscriptions_revoked_24h, v_subscriptions_active
  from public.push_subscriptions;

  select count(*) into v_cards_failed_24h
  from public.system_error_events
  where area = 'compartilhamentos' and last_seen_at >= now() - interval '24 hours';

  select count(*) into v_uploads_failed_24h
  from public.system_error_events
  where area = 'uploads' and last_seen_at >= now() - interval '24 hours';

  select count(*) into v_onboarding_stuck
  from public.users
  where deleted_at is null
    and onboarding_completed = false
    and created_at < now() - interval '48 hours';

  select jsonb_build_object(
    'lastSeenAt', last_seen_at,
    'occurrenceCount', occurrence_count,
    'severity', severity,
    'metadata', metadata_safe
  )
  into v_last_cron
  from public.system_error_events
  where area = 'cron' and operation = 'notifications_process_run'
  order by last_seen_at desc
  limit 1;

  if v_open_critical_24h > 0
    or v_campaigns_failed_24h > 0
    or coalesce((v_last_cron->>'lastSeenAt')::timestamptz, 'epoch'::timestamptz) < now() - interval '36 hours'
  then
    v_status := 'critico';
  elsif v_open_error_24h > 0 and (v_max_occurrence_24h >= 5 or v_campaigns_partial_24h > 0)
  then
    v_status := 'degradado';
  elsif v_errors_24h > 0 or v_onboarding_stuck >= 5
  then
    v_status := 'atencao';
  else
    v_status := 'saudavel';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'errors24h', v_errors_24h,
    'errors7d', v_errors_7d,
    'usersAffected24h', v_users_affected_24h,
    'openCriticalErrors24h', v_open_critical_24h,
    'openErrors24h', v_open_error_24h,
    'campaignsFailed24h', v_campaigns_failed_24h,
    'campaignsPartial24h', v_campaigns_partial_24h,
    'deliveriesFailed24h', v_deliveries_failed_24h,
    'deliveriesPending', v_deliveries_pending,
    'deliveriesRetry', v_deliveries_retry,
    'subscriptionsRevoked24h', v_subscriptions_revoked_24h,
    'subscriptionsActive', v_subscriptions_active,
    'cardsFailed24h', v_cards_failed_24h,
    'uploadsFailed24h', v_uploads_failed_24h,
    'onboardingStuck', v_onboarding_stuck,
    'lastCronRun', v_last_cron
  );
end;
$$;

-- "Usuario ativo" (Parte C): sem last_sign_in_at (nao reflete uso real do
-- produto). Reaproveita EXATAMENTE o sinal ja usado por
-- admin_dashboard_overview (0006) para "participante ativo" -
-- daily_logs.updated_at, que e tocado tanto por ensure_today_daily_log
-- (qualquer visita a "Hoje") quanto por qualquer registro de habito ou
-- finalizacao. E o unico sinal de atividade real ja persistido de forma
-- unica e confiavel neste schema, sem exigir uma segunda fonte
-- (analytics_events e melhor esforco/client-side e pode ter lacunas).
--
-- "Hoje" usa America/Sao_Paulo como fuso de referencia unico (o mesmo
-- assumido pelo cron e pelo timezone padrao de public.users) - metricas
-- diarias sao operacionais/aproximadas, nao por-usuario-timezone (evitaria
-- N+1 de join por fuso individual).
create or replace function public.admin_operational_overview(p_period text default 'today')
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_period_start timestamptz;
  v_health jsonb;
  v_active_users integer;
  v_days_finalized integer;
  v_new_signups integer;
  v_enrollments integer;
  v_campaigns_sent integer;
  v_notifications_delivered integer;
  v_tips_published integer;
  v_cards_generated integer;
  v_current_challenge record;
  v_current_challenge_active_participants integer;
  v_deploy_note text;
begin
  perform public.admin_require_admin();

  if p_period not in ('today', '24h', '7d') then
    raise exception 'Periodo invalido.' using errcode = '22023';
  end if;

  v_period_start := case p_period
    when 'today' then date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
    when '24h' then now() - interval '24 hours'
    else now() - interval '7 days'
  end;

  -- Saude geral: SEMPRE a mesma funcao/regra da Observabilidade, nunca
  -- recalculada aqui.
  v_health := public.admin_get_system_health_overview();

  select count(distinct ce.user_id)
  into v_active_users
  from public.daily_logs dl
  join public.challenge_enrollments ce on ce.id = dl.enrollment_id
  where dl.updated_at >= v_period_start;

  select count(*) into v_days_finalized
  from public.daily_logs
  where finalized_at >= v_period_start;

  select count(*) into v_new_signups
  from public.users
  where created_at >= v_period_start and deleted_at is null;

  select count(*) into v_enrollments
  from public.challenge_enrollments
  where joined_at >= v_period_start;

  select count(*) into v_campaigns_sent
  from public.notification_campaigns
  where started_at >= v_period_start;

  select count(*) into v_notifications_delivered
  from public.notification_deliveries
  where sent_at >= v_period_start
    and status in ('sent', 'delivered', 'opened', 'read', 'clicked');

  select count(*) into v_tips_published
  from public.content_items
  where content_type = 'tip_card' and status = 'published';

  select count(*) into v_cards_generated
  from public.share_cards
  where generated_at >= v_period_start;

  select id, name into v_current_challenge
  from public.challenges
  where status = 'active' and is_test = false and deleted_at is null
  order by start_date desc nulls last, created_at desc
  limit 1;

  if v_current_challenge.id is not null then
    select count(*) into v_current_challenge_active_participants
    from public.challenge_enrollments
    where challenge_id = v_current_challenge.id
      and status in ('active', 'paused');
  else
    v_current_challenge_active_participants := 0;
  end if;

  -- Vercel Hobby plan (documentado desde 0071/api/cron): 1 execucao/dia -
  -- nunca inventamos um "proximo horario" mais frequente que isso.
  v_deploy_note := 'Cron limitado a 1 execucao/dia no plano atual da Vercel.';

  return jsonb_build_object(
    'period', p_period,
    'periodStart', v_period_start,
    'health', v_health,
    'metrics', jsonb_build_object(
      'activeUsers', v_active_users,
      'daysFinalized', v_days_finalized,
      'newSignups', v_new_signups,
      'enrollments', v_enrollments,
      'campaignsSent', v_campaigns_sent,
      'notificationsDelivered', v_notifications_delivered,
      'criticalErrors', v_health->>'openCriticalErrors24h',
      'warnings', v_health->>'openErrors24h'
    ),
    'blocks', jsonb_build_object(
      'currentChallengeName', v_current_challenge.name,
      'currentChallengeActiveParticipants', v_current_challenge_active_participants,
      'tipsPublished', v_tips_published,
      'cardsGenerated', v_cards_generated
    ),
    'cronNote', v_deploy_note
  );
end;
$$;

revoke all on function public.admin_operational_overview(text) from public, anon;
grant execute on function public.admin_operational_overview(text) to authenticated;

-- Atividade recente (Parte F): reaproveita admin_audit_logs (acoes de
-- admin - nunca before_json/after_json, que podem conter e-mail),
-- notification_campaigns (envios) e system_error_events (erros
-- criticos/error registrados ou resolvidos). Nenhuma tabela nova.
create or replace function public.admin_recent_activity(p_limit integer default 10)
returns table (
  occurred_at timestamptz,
  category text,
  label text,
  detail text,
  actor_name text,
  link text
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 25);
begin
  perform public.admin_require_admin();

  return query
  (
    select
      l.created_at,
      'admin'::text,
      l.action,
      l.entity_type,
      u.display_name,
      case
        when l.entity_type = 'user' and l.entity_id is not null then '/admin/usuarios/' || l.entity_id
        else null
      end
    from public.admin_audit_logs l
    left join public.users u on u.id = l.admin_user_id
    order by l.created_at desc
    limit v_limit
  )
  union all
  (
    select
      coalesce(c.completed_at, c.started_at, c.created_at),
      'notificacoes'::text,
      c.title,
      c.status,
      null::text,
      '/admin/notificacoes/' || c.id
    from public.notification_campaigns c
    where c.started_at is not null
    order by coalesce(c.completed_at, c.started_at, c.created_at) desc
    limit v_limit
  )
  union all
  (
    select
      e.last_seen_at,
      'observabilidade'::text,
      e.error_code,
      e.area || ': ' || e.operation,
      null::text,
      '/admin/observabilidade/' || e.id
    from public.system_error_events e
    where e.severity in ('critical', 'error')
    order by e.last_seen_at desc
    limit v_limit
  )
  order by 1 desc
  limit v_limit;
end;
$$;

revoke all on function public.admin_recent_activity(integer) from public, anon;
grant execute on function public.admin_recent_activity(integer) to authenticated;

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check check (
    event_name in (
      'challenge_catalog_viewed',
      'challenge_detail_viewed',
      'challenge_join_clicked',
      'challenge_joined',
      'challenge_first_habit_completed',
      'challenge_day_completed',
      'challenge_day_7_reached',
      'challenge_halfway_reached',
      'challenge_completed',
      'challenge_abandoned',
      'share_achievement_started',
      'share_achievement_completed',
      'challenge_paused',
      'challenge_resumed',
      'challenge_ended',
      'enrollment_paused',
      'enrollment_resumed',
      'tip_card_viewed',
      'tip_card_opened',
      'tip_card_downloaded',
      'notification_campaign_created',
      'notification_campaign_scheduled',
      'notification_scheduled',
      'notification_sent',
      'notification_failed',
      'notification_opened',
      'notification_read',
      'notification_clicked',
      'push_permission_granted',
      'push_permission_denied',
      'push_subscription_created',
      'push_subscription_revoked',
      'daily_completion_summary_viewed',
      'daily_completion_continue_clicked',
      'daily_completion_journey_clicked',
      'daily_completion_share_clicked',
      'profile_dashboard_viewed',
      'profile_timeline_filter_changed',
      'profile_challenge_opened',
      'profile_achievement_shared',
      'profile_edit_clicked',
      'dashboard_mission_opened',
      'dashboard_continue_day_clicked',
      'dashboard_next_goal_clicked',
      'timeline_event_expanded',
      'evolution_share_started',
      'evolution_share_completed',
      'evolution_share_downloaded',
      'share_template_previewed',
      'dashboard_context_message_viewed',
      'admin_overview_viewed'
    )
  );

create or replace function public.record_analytics_event(
  p_event_name text,
  p_challenge_id uuid default null,
  p_enrollment_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_session_id text default null,
  p_source text default 'client',
  p_content_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  inserted_id uuid;
begin
  if p_event_name is null or p_event_name not in (
    'challenge_catalog_viewed',
    'challenge_detail_viewed',
    'challenge_join_clicked',
    'challenge_joined',
    'challenge_first_habit_completed',
    'challenge_day_completed',
    'challenge_day_7_reached',
    'challenge_halfway_reached',
    'challenge_completed',
    'challenge_abandoned',
    'share_achievement_started',
    'share_achievement_completed',
    'challenge_paused',
    'challenge_resumed',
    'challenge_ended',
    'enrollment_paused',
    'enrollment_resumed',
    'tip_card_viewed',
    'tip_card_opened',
    'tip_card_downloaded',
    'notification_campaign_created',
    'notification_campaign_scheduled',
    'notification_scheduled',
    'notification_sent',
    'notification_failed',
    'notification_opened',
    'notification_read',
    'notification_clicked',
    'push_permission_granted',
    'push_permission_denied',
    'push_subscription_created',
    'push_subscription_revoked',
    'daily_completion_summary_viewed',
    'daily_completion_continue_clicked',
    'daily_completion_journey_clicked',
    'daily_completion_share_clicked',
    'profile_dashboard_viewed',
    'profile_timeline_filter_changed',
    'profile_challenge_opened',
    'profile_achievement_shared',
    'profile_edit_clicked',
    'dashboard_mission_opened',
    'dashboard_continue_day_clicked',
    'dashboard_next_goal_clicked',
    'timeline_event_expanded',
    'evolution_share_started',
    'evolution_share_completed',
    'evolution_share_downloaded',
    'share_template_previewed',
    'dashboard_context_message_viewed',
    'admin_overview_viewed'
  ) then
    raise exception 'Nome de evento nao permitido.'
      using errcode = '22023';
  end if;

  if p_source not in ('server', 'client') then
    raise exception 'Origem de evento invalida.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(normalized_metadata) <> 'object' then
    raise exception 'Metadata de evento precisa ser um objeto JSON.'
      using errcode = '22023';
  end if;

  insert into public.analytics_events (
    user_id, event_name, challenge_id, enrollment_id, content_item_id, metadata, session_id, source
  )
  values (
    actor_id, p_event_name, p_challenge_id, p_enrollment_id, p_content_item_id, normalized_metadata,
    nullif(trim(coalesce(p_session_id, '')), ''), p_source
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid) from public, anon;
grant execute on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid) to authenticated;
