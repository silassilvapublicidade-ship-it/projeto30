-- Observabilidade leve (Admin > /admin/observabilidade).
--
-- Por que uma tabela nova: auditoria confirmou que hoje NENHUMA fonte
-- existente persiste falhas de forma consultável. admin_audit_logs audita
-- ACOES de admin (nao falhas de sistema). analytics_events e best-effort e
-- despejado silenciosamente em caso de erro (analytics.service.ts). Toda
-- captura de erro hoje e console.error efemero (rpc-logging.service.ts,
-- journey.actions.ts, admin/error.tsx) - visivel so nos logs da Vercel.
-- Saude de notificacoes, cards, uploads e onboarding SAO derivaveis das
-- tabelas ja existentes (notification_campaigns/deliveries,
-- push_subscriptions, share_cards, users) e continuam sendo lidas ao vivo
-- pelas RPCs abaixo, sem duplicar dado - esta tabela guarda so o que mais
-- nenhuma tabela guarda: ocorrencias de falha agrupadas por fingerprint.
--
-- Postura de acesso: RLS habilitado, ZERO policies de select/insert/update
-- na tabela base - todo acesso (leitura e escrita) passa por funcoes
-- security definer com grants minimos. Um admin comum nunca ve
-- user_id/postgres_code/metadata_safe (redigidos nas RPCs de leitura);
-- so super_admin ve o detalhe completo e pode resolver ocorrencias.
create table if not exists public.system_error_events (
  id uuid primary key default gen_random_uuid(),
  error_code text not null,
  fingerprint text not null,
  area text not null,
  operation text not null,
  severity text not null,
  message_safe text not null,
  route text,
  postgres_code text,
  user_id uuid references public.users(id) on delete set null,
  metadata_safe jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'open',
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  resolution_note text,
  resolved_in_version text,
  app_version text,
  created_at timestamptz not null default now(),
  constraint system_error_events_area_check check (area in (
    'auth', 'onboarding', 'desafios', 'habitos', 'finalizacao', 'conquistas',
    'compartilhamentos', 'dicas', 'uploads', 'notificacoes', 'cron', 'admin',
    'pwa', 'app'
  )),
  constraint system_error_events_severity_check check (severity in ('info', 'warning', 'error', 'critical')),
  constraint system_error_events_status_check check (status in ('open', 'investigating', 'resolved')),
  constraint system_error_events_message_length check (char_length(message_safe) <= 500),
  constraint system_error_events_resolution_note_length check (
    resolution_note is null or char_length(resolution_note) <= 500
  ),
  constraint system_error_events_metadata_is_object check (jsonb_typeof(metadata_safe) = 'object'),
  constraint system_error_events_metadata_size check (octet_length(metadata_safe::text) <= 2000)
);

create unique index if not exists system_error_events_fingerprint_key
  on public.system_error_events (fingerprint);
create index if not exists system_error_events_last_seen_idx
  on public.system_error_events (last_seen_at desc);
create index if not exists system_error_events_status_idx
  on public.system_error_events (status);
create index if not exists system_error_events_severity_idx
  on public.system_error_events (severity);
create index if not exists system_error_events_area_idx
  on public.system_error_events (area);
create index if not exists system_error_events_user_idx
  on public.system_error_events (user_id) where user_id is not null;

alter table public.system_error_events enable row level security;
-- Sem policies: authenticated/anon nao leem nem escrevem a tabela direto.
-- Todo acesso passa pelas funcoes abaixo.

-- Retencao: politica definida (nao automatica). Ocorrencias resolvidas com
-- mais de 60 dias podem ser removidas via admin_purge_old_system_error_events,
-- acionada manualmente por super_admin - nunca um cron silencioso apagando
-- historico. Ocorrencias nao resolvidas nunca sao purgadas por esta funcao.

-- Padroes proibidos em texto livre (defesa em profundidade - a camada TS ja
-- sanitiza antes de chamar esta funcao, isto e um segundo cinto de
-- seguranca no banco).
create or replace function public._system_error_text_is_safe(p_text text)
returns boolean
language sql
immutable
as $$
  select p_text !~* '(password|senha|token|cookie|authorization|service_role|api[_-]?key|@[a-z0-9.-]+\.[a-z]{2,})';
$$;

create or replace function public.record_system_error(
  p_area text,
  p_operation text,
  p_severity text,
  p_message_safe text,
  p_route text default null,
  p_postgres_code text default null,
  p_user_id uuid default null,
  p_metadata_safe jsonb default '{}'::jsonb,
  p_app_version text default null
)
returns table (error_code text, occurrence_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normalized_metadata jsonb := coalesce(p_metadata_safe, '{}'::jsonb);
  v_message text := left(trim(coalesce(p_message_safe, '')), 500);
  v_fingerprint text;
  v_error_code text;
  v_area_short text;
  v_row public.system_error_events%rowtype;
begin
  if p_area is null or p_area not in (
    'auth', 'onboarding', 'desafios', 'habitos', 'finalizacao', 'conquistas',
    'compartilhamentos', 'dicas', 'uploads', 'notificacoes', 'cron', 'admin',
    'pwa', 'app'
  ) then
    raise exception 'Area de erro invalida.' using errcode = '22023';
  end if;

  if p_severity not in ('info', 'warning', 'error', 'critical') then
    raise exception 'Severidade invalida.' using errcode = '22023';
  end if;

  if v_message = '' then
    raise exception 'Mensagem do erro e obrigatoria.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_normalized_metadata) <> 'object' then
    raise exception 'Metadata precisa ser um objeto JSON.' using errcode = '22023';
  end if;

  if octet_length(v_normalized_metadata::text) > 2000 then
    raise exception 'Metadata excede o tamanho permitido.' using errcode = '22023';
  end if;

  if not public._system_error_text_is_safe(v_message)
    or not public._system_error_text_is_safe(v_normalized_metadata::text)
    or not public._system_error_text_is_safe(coalesce(p_operation, ''))
  then
    raise exception 'Conteudo do evento contem um padrao nao permitido.' using errcode = '22023';
  end if;

  v_area_short := upper(left(regexp_replace(p_area, '[^a-zA-Z]', '', 'g'), 5));
  v_fingerprint := md5(
    p_area || ':' || coalesce(p_operation, '') || ':' || coalesce(p_postgres_code, '') || ':' || left(v_message, 100)
  );
  v_error_code := 'P30-' || v_area_short || '-' || to_char(now(), 'YYYYMMDD') || '-' || upper(left(v_fingerprint, 4));

  insert into public.system_error_events as see (
    error_code, fingerprint, area, operation, severity, message_safe, route,
    postgres_code, user_id, metadata_safe, app_version
  )
  values (
    v_error_code, v_fingerprint, p_area, coalesce(p_operation, 'unknown'), p_severity, v_message, p_route,
    p_postgres_code, p_user_id, v_normalized_metadata, p_app_version
  )
  on conflict (fingerprint) do update set
    occurrence_count = see.occurrence_count + 1,
    last_seen_at = now(),
    severity = excluded.severity,
    message_safe = excluded.message_safe,
    route = excluded.route,
    user_id = coalesce(excluded.user_id, see.user_id),
    metadata_safe = excluded.metadata_safe,
    app_version = excluded.app_version
  returning see.* into v_row;

  return query select v_row.error_code, v_row.occurrence_count;
end;
$$;

revoke execute on function public.record_system_error(text, text, text, text, text, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_system_error(text, text, text, text, text, text, uuid, jsonb, text) to service_role;

-- Leitura paginada, com redacao de colunas sensiveis para admin comum.
-- super_admin ve tudo; admin ve tudo exceto user_id/postgres_code/metadata_safe.
create or replace function public.admin_list_system_error_events(
  p_area text default null,
  p_severity text default null,
  p_status text default null,
  p_operation text default null,
  p_error_code text default null,
  p_period_start timestamptz default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  error_code text,
  area text,
  operation text,
  severity text,
  message_safe text,
  route text,
  postgres_code text,
  user_id uuid,
  metadata_safe jsonb,
  occurrence_count integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  status text,
  resolved_at timestamptz,
  resolution_note text,
  app_version text,
  total_count bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  v_role := public.admin_require_admin();

  return query
  select
    e.id, e.error_code, e.area, e.operation, e.severity, e.message_safe, e.route,
    case when v_role = 'super_admin' then e.postgres_code else null end,
    case when v_role = 'super_admin' then e.user_id else null end,
    case when v_role = 'super_admin' then e.metadata_safe else '{}'::jsonb end,
    e.occurrence_count, e.first_seen_at, e.last_seen_at, e.status, e.resolved_at,
    e.resolution_note, e.app_version,
    count(*) over () as total_count
  from public.system_error_events e
  where (p_area is null or e.area = p_area)
    and (p_severity is null or e.severity = p_severity)
    and (p_status is null or e.status = p_status)
    and (p_operation is null or e.operation = p_operation)
    and (p_error_code is null or e.error_code = p_error_code)
    and (p_period_start is null or e.last_seen_at >= p_period_start)
  order by e.last_seen_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke execute on function public.admin_list_system_error_events(text, text, text, text, text, timestamptz, integer, integer) from public, anon;
grant execute on function public.admin_list_system_error_events(text, text, text, text, text, timestamptz, integer, integer) to authenticated;

create or replace function public.admin_get_system_error_event(p_id uuid)
returns table (
  id uuid, error_code text, area text, operation text, severity text, message_safe text,
  route text, postgres_code text, user_id uuid, metadata_safe jsonb, occurrence_count integer,
  first_seen_at timestamptz, last_seen_at timestamptz, status text, resolved_at timestamptz,
  resolved_by uuid, resolution_note text, resolved_in_version text, app_version text
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
begin
  v_role := public.admin_require_admin();

  return query
  select
    e.id, e.error_code, e.area, e.operation, e.severity, e.message_safe, e.route,
    case when v_role = 'super_admin' then e.postgres_code else null end,
    case when v_role = 'super_admin' then e.user_id else null end,
    case when v_role = 'super_admin' then e.metadata_safe else '{}'::jsonb end,
    e.occurrence_count, e.first_seen_at, e.last_seen_at, e.status, e.resolved_at,
    case when v_role = 'super_admin' then e.resolved_by else null end,
    e.resolution_note, e.resolved_in_version, e.app_version
  from public.system_error_events e
  where e.id = p_id;
end;
$$;

revoke execute on function public.admin_get_system_error_event(uuid) from public, anon;
grant execute on function public.admin_get_system_error_event(uuid) to authenticated;

-- Resolucao: exclusiva de super_admin. Nunca apaga a linha - so muda status
-- e grava auditoria em admin_audit_logs (mesmo padrao ja usado em todo o
-- admin, ver admin-users.actions.ts).
create or replace function public.admin_resolve_system_error_event(
  p_id uuid,
  p_status text,
  p_resolution_note text default null,
  p_resolved_in_version text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_actor_id uuid := auth.uid();
  v_before jsonb;
  v_note text := nullif(left(trim(coalesce(p_resolution_note, '')), 500), '');
begin
  v_role := public.admin_require_admin();

  if v_role <> 'super_admin' then
    raise exception 'Apenas super administradores podem alterar o status de uma ocorrencia.'
      using errcode = '42501';
  end if;

  if p_status not in ('open', 'investigating', 'resolved') then
    raise exception 'Status invalido.' using errcode = '22023';
  end if;

  if v_note is not null and not public._system_error_text_is_safe(v_note) then
    raise exception 'Nota contem um padrao nao permitido.' using errcode = '22023';
  end if;

  select jsonb_build_object('status', status, 'resolution_note', resolution_note)
  into v_before
  from public.system_error_events
  where id = p_id;

  if v_before is null then
    raise exception 'Ocorrencia nao encontrada.' using errcode = 'P0002';
  end if;

  update public.system_error_events
  set
    status = p_status,
    resolution_note = coalesce(v_note, resolution_note),
    resolved_in_version = coalesce(p_resolved_in_version, resolved_in_version),
    resolved_at = case when p_status = 'resolved' then now() else null end,
    resolved_by = case when p_status = 'resolved' then v_actor_id else null end
  where id = p_id;

  insert into public.admin_audit_logs (action, admin_user_id, entity_id, entity_type, before_json, after_json)
  values (
    'admin_resolve_system_error_event', v_actor_id, p_id, 'system_error_event',
    v_before,
    jsonb_build_object('status', p_status, 'resolution_note', v_note)
  );
end;
$$;

revoke execute on function public.admin_resolve_system_error_event(uuid, text, text, text) from public, anon;
grant execute on function public.admin_resolve_system_error_event(uuid, text, text, text) to authenticated;

-- Purga manual (retencao). Nunca remove ocorrencias nao resolvidas.
create or replace function public.admin_purge_old_system_error_events(p_older_than_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
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
  return v_deleted;
end;
$$;

revoke execute on function public.admin_purge_old_system_error_events(integer) from public, anon;
grant execute on function public.admin_purge_old_system_error_events(integer) to authenticated;

-- Visao geral: agrega system_error_events + tabelas ja existentes
-- (notification_campaigns/deliveries, push_subscriptions, users) sem
-- duplicar dado nenhum que ja possa ser lido ao vivo.
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

  -- Status geral: criterios objetivos, checados em ordem de gravidade.
  -- Critico: erro critico aberto nas ultimas 24h, campanha falha nas
  --   ultimas 24h, ou cron sem rodar com sucesso ha mais de 36h (agenda e
  --   diaria).
  -- Degradado: erro (nao critico) aberto e repetindo (>=5 ocorrencias) nas
  --   ultimas 24h, campanha parcialmente falha, ou 3+ tipos de erro aberto.
  -- Atencao: qualquer warning/error aberto nas ultimas 24h, ou 5+ usuarios
  --   presos no onboarding ha mais de 48h.
  -- Saudavel: nenhum dos casos acima.
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

revoke execute on function public.admin_get_system_health_overview() from public, anon;
grant execute on function public.admin_get_system_health_overview() to authenticated;
