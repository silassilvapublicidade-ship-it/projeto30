-- Corrige um falso "Crítico" encontrado em investigação real (Parte A):
-- o cron RODA de verdade todo dia (prova real: notification_campaigns tem
-- uma campanha source='automation', automation_type='user_inactive_3_days',
-- started_at/completed_at às 12:21 UTC do dia do deploy desta auditoria -
-- exatamente a janela do schedule "0 12 * * *" de vercel.json). O status
-- "critico" só aparecia porque a instrumentação que grava
-- system_error_events(area='cron') foi implantada DEPOIS da janela diária
-- do cron (deploy às ~22:25 UTC, cron às ~12:21 UTC) - "nunca registrou"
-- != "nunca rodou". A regra antiga tratava ausência de telemetria nova
-- como falha ampla do sistema inteiro, o que é falso.
--
-- Correção (nunca maquiando o painel - continua honesto quando há
-- impacto real):
-- 1) Novo sinal de evidência independente: a última campanha
--    source='automation' já disparada (dado 100% real, já existente,
--    nunca fabricado) conta como prova de que o pipeline está vivo, até
--    que a telemetria nova tenha sua primeira chance real de rodar.
-- 2) Novo sinal de impacto real: campanhas agendadas (status='scheduled')
--    cujo scheduled_for já passou e ainda não foram processadas -
--    trabalho pendente de verdade, não presunção.
-- 3) Critico por causa do cron passa a exigir AMBOS: ausência de
--    evidência recente E trabalho pendente real. Sem trabalho pendente,
--    "cron sem evidência recente" vira Atenção (aguardando execução),
--    nunca Crítico - exatamente a Parte A.4.
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
  elsif v_errors_24h > 0 or v_onboarding_stuck >= 5 or not v_cron_has_recent_evidence
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
