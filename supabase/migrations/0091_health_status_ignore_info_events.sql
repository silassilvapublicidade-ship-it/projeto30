-- Falso positivo real encontrado em producao (voce pediu "verifique" no
-- badge "Atencao" da Central Operacional): v_errors_24h conta QUALQUER
-- linha de system_error_events nas ultimas 24h, sem filtrar severidade -
-- inclusive o proprio heartbeat de "prova de vida" do cron
-- (area='cron', operation='notifications_process_run', severity='info',
-- introduzido pela 0075 exatamente para PROVAR que o processador roda).
-- Resultado: todo dia que o cron roda com sucesso, esse evento informativo
-- por si so empurra o status para 'atencao' - o oposto do que deveria
-- acontecer (um heartbeat saudavel virando "precisa checar").
--
-- Confirmado em producao antes desta migration: unica linha de
-- system_error_events nos ultimos 2 dias era exatamente esse heartbeat
-- ("Cron executado com sucesso...", severity='info', status='open').
--
-- Correcao cirurgica: 'errors24h'/'errors7d' no payload retornado
-- continuam contando tudo (sao exibidos como metrica bruta em
-- /admin/observabilidade - "X evento(s) nas ultimas 24h" - mudar esse
-- numero seria uma mudanca de UX nao pedida). Só o GATILHO do status
-- 'atencao' passa a usar uma contagem separada que ignora severity='info'
-- - um evento puramente informativo nunca mais, sozinho, empurra o
-- status geral para fora de 'saudavel'.
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
  v_actionable_errors_24h integer;
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
  v_overdue_scheduled_campaigns integer;
  v_last_automation_activity timestamptz;
  v_cron_evidence_at timestamptz;
  v_cron_has_recent_evidence boolean;
  v_status text;
begin
  perform public.admin_require_admin();

  select count(*) filter (where last_seen_at >= now() - interval '24 hours'),
         count(*) filter (where last_seen_at >= now() - interval '7 days')
  into v_errors_24h, v_errors_7d
  from public.system_error_events;

  -- Só conta para o GATILHO do status - nunca um evento informativo
  -- (ex.: o heartbeat de sucesso do cron) sozinho.
  select count(*) filter (where severity in ('warning', 'error', 'critical') and last_seen_at >= now() - interval '24 hours')
  into v_actionable_errors_24h
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

  select count(*) into v_overdue_scheduled_campaigns
  from public.notification_campaigns
  where status = 'scheduled' and scheduled_for < now();

  select max(started_at) into v_last_automation_activity
  from public.notification_campaigns
  where source = 'automation' and started_at is not null;

  v_cron_evidence_at := greatest(
    coalesce((v_last_cron->>'lastSeenAt')::timestamptz, 'epoch'::timestamptz),
    coalesce(v_last_automation_activity, 'epoch'::timestamptz)
  );
  v_cron_has_recent_evidence := v_cron_evidence_at >= now() - interval '36 hours';

  -- Critico: falha ampla confirmada (erro critico aberto, campanha
  -- totalmente falha) OU trabalho pendente real sem evidencia de
  -- processamento recente. Nunca so por ausencia de telemetria.
  if v_open_critical_24h > 0
    or v_campaigns_failed_24h > 0
    or (v_overdue_scheduled_campaigns > 0 and not v_cron_has_recent_evidence)
  then
    v_status := 'critico';
  -- Degradado: funcionalidade importante com falha confirmada (erro se
  -- repetindo ou campanha parcialmente falha).
  elsif v_open_error_24h > 0 and (v_max_occurrence_24h >= 5 or v_campaigns_partial_24h > 0)
  then
    v_status := 'degradado';
  -- Atencao: sinais recuperaveis/isolados, incluindo "aguardando a
  -- primeira execucao confirmada" quando NAO ha trabalho pendente real.
  -- Usa v_actionable_errors_24h (nunca v_errors_24h) - um evento so
  -- informativo (ex.: heartbeat de sucesso do cron) nunca sozinho empurra
  -- o status para fora de 'saudavel'.
  elsif v_actionable_errors_24h > 0 or v_onboarding_stuck >= 5 or not v_cron_has_recent_evidence
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
    'lastCronRun', v_last_cron,
    'overdueScheduledCampaigns', v_overdue_scheduled_campaigns,
    'lastAutomationActivityAt', v_last_automation_activity,
    'cronHasRecentEvidence', v_cron_has_recent_evidence
  );
end;
$$;
