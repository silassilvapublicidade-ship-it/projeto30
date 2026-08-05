-- Auditoria de Storage (Parte A) + purga manual de diagnosticos (Parte B).
--
-- storage_audit_runs guarda so o RESUMO de cada execucao (inicio, fim,
-- duracao, contagens por bucket em jsonb) - nunca uma linha por objeto.
-- Com o volume real hoje (poucas dezenas de objetos em 5 buckets), o
-- detalhe por item e recalculado ao vivo (read-only, rapido) sempre que o
-- admin abre os detalhes ou aciona a limpeza - isso automaticamente
-- resolve a exigencia de "revalidar antes de excluir" (Parte 6): nao ha
-- linha persistida que possa ficar desatualizada.
create table if not exists public.storage_audit_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_ms integer,
  triggered_by uuid references public.users(id) on delete set null,
  buckets_audited text[] not null default '{}',
  total_objects integer not null default 0,
  total_bytes bigint not null default 0,
  orphan_count integer not null default 0,
  missing_reference_count integer not null default 0,
  suspicious_count integer not null default 0,
  bucket_breakdown jsonb not null default '[]'::jsonb,
  status text not null default 'completed',
  error_message text,
  created_at timestamptz not null default now(),
  constraint storage_audit_runs_status_check check (status in ('running', 'completed', 'failed')),
  constraint storage_audit_runs_bucket_breakdown_is_array check (jsonb_typeof(bucket_breakdown) = 'array')
);

create index if not exists storage_audit_runs_started_at_idx
  on public.storage_audit_runs (started_at desc);

alter table public.storage_audit_runs enable row level security;
-- Sem policies diretas - a execucao real (Storage list/delete) so acontece
-- server-side com o client de service_role (nunca no navegador); leitura
-- do resumo passa pela RPC abaixo, admin-gated.

create or replace function public.admin_get_latest_storage_audit_run()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_row public.storage_audit_runs%rowtype;
begin
  perform public.admin_require_admin();

  select * into v_row
  from public.storage_audit_runs
  where status = 'completed'
  order by started_at desc
  limit 1;

  if v_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'startedAt', v_row.started_at,
    'finishedAt', v_row.finished_at,
    'durationMs', v_row.duration_ms,
    'bucketsAudited', v_row.buckets_audited,
    'totalObjects', v_row.total_objects,
    'totalBytes', v_row.total_bytes,
    'orphanCount', v_row.orphan_count,
    'missingReferenceCount', v_row.missing_reference_count,
    'suspiciousCount', v_row.suspicious_count,
    'bucketBreakdown', v_row.bucket_breakdown
  );
end;
$$;

revoke all on function public.admin_get_latest_storage_audit_run() from public, anon;
grant execute on function public.admin_get_latest_storage_audit_run() to authenticated;

-- Preview da purga (Parte B.9) - somente leitura, nunca mensagem sensivel
-- (so contagens e datas). Qualquer admin pode ver (mesma regra de "ver
-- resumo" ja aplicada em Observabilidade); so a EXECUCAO exige super_admin.
create or replace function public.admin_preview_system_error_purge(p_older_than_days integer default 60)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_days integer := greatest(coalesce(p_older_than_days, 60), 30);
  v_count integer;
  v_oldest timestamptz;
  v_newest timestamptz;
  v_severity jsonb;
  v_area jsonb;
begin
  perform public.admin_require_admin();

  select count(*), min(resolved_at), max(resolved_at)
  into v_count, v_oldest, v_newest
  from public.system_error_events
  where status = 'resolved' and resolved_at < now() - make_interval(days => v_days);

  select coalesce(jsonb_object_agg(severity, cnt), '{}'::jsonb) into v_severity
  from (
    select severity, count(*) as cnt
    from public.system_error_events
    where status = 'resolved' and resolved_at < now() - make_interval(days => v_days)
    group by severity
  ) s;

  select coalesce(jsonb_object_agg(area, cnt), '{}'::jsonb) into v_area
  from (
    select area, count(*) as cnt
    from public.system_error_events
    where status = 'resolved' and resolved_at < now() - make_interval(days => v_days)
    group by area
  ) a;

  return jsonb_build_object(
    'eligibleCount', coalesce(v_count, 0),
    'oldestResolvedAt', v_oldest,
    'newestResolvedAt', v_newest,
    'severityBreakdown', v_severity,
    'areaBreakdown', v_area,
    'cutoffDays', v_days
  );
end;
$$;

revoke all on function public.admin_preview_system_error_purge(integer) from public, anon;
grant execute on function public.admin_preview_system_error_purge(integer) to authenticated;

-- Purga (ja existia desde 0072) - aditivo: agora tambem grava auditoria
-- (Parte 10 exige admin/horario/resultado registrados). Comportamento de
-- selecao/protecao de linhas nao-resolvidas continua identico.
create or replace function public.admin_purge_old_system_error_events(p_older_than_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_actor_id uuid := auth.uid();
  v_days integer := greatest(coalesce(p_older_than_days, 60), 30);
  v_deleted integer;
begin
  v_role := public.admin_require_admin();

  if v_role <> 'super_admin' then
    raise exception 'Apenas super administradores podem executar a purga.'
      using errcode = '42501';
  end if;

  delete from public.system_error_events
  where status = 'resolved'
    and resolved_at < now() - make_interval(days => v_days);

  get diagnostics v_deleted = row_count;

  insert into public.admin_audit_logs (action, admin_user_id, entity_type, after_json)
  values (
    'admin_purge_old_system_error_events',
    v_actor_id,
    'system_error_event',
    jsonb_build_object('deletedCount', v_deleted, 'cutoffDays', v_days)
  );

  return v_deleted;
end;
$$;

-- Analytics (Parte G) - so os 4 eventos desta parte (storage + purga).
-- Os de feedback entram na migration seguinte, junto da tabela.
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
      'admin_overview_viewed',
      'storage_audit_started',
      'storage_audit_completed',
      'storage_cleanup_completed',
      'error_retention_purge_completed'
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
    'admin_overview_viewed',
    'storage_audit_started',
    'storage_audit_completed',
    'storage_cleanup_completed',
    'error_retention_purge_completed'
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
