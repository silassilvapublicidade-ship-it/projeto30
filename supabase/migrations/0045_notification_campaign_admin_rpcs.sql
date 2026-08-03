-- Modulo F, Rodada F2: segmentacao no servidor + RPCs administrativas de
-- campanha. Toda segmentacao (secao 11 do briefing) acontece aqui - nunca
-- um filtro SQL arbitrario vindo da UI. O mesmo resolver
-- (resolve_notification_audience) e usado tanto para a estimativa mostrada
-- no compositor quanto para materializar as deliveries de verdade no envio
-- - a estimativa nunca pode divergir do envio real.
--
-- Regra de canal: o canal interno (notifications) e sempre entregue para
-- todo o publico resolvido, independente de push - e exatamente isso que
-- garante "mesmo que o usuario nao autorize push, ele continua recebendo
-- notificacoes internas quando aplicavel". O canal push so e tentado para
-- quem tem push_enabled=true E uma subscription ativa - resolvido aqui via
-- push_eligible, calculado junto com o publico base para nunca divergir.

create or replace function public.resolve_notification_audience(
  p_audience_type text,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null
)
returns table (push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_audience_type = 'all_active_users' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.status = 'active' and u.deleted_at is null;

  elsif p_audience_type = 'specific_user' then
    if p_specific_user_id is null then
      return;
    end if;
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.id = p_specific_user_id and u.status = 'active' and u.deleted_at is null;

  elsif p_audience_type = 'challenge_participants' then
    if p_challenge_id is null then
      return;
    end if;
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.challenge_id = p_challenge_id and u.status = 'active' and u.deleted_at is null;

  elsif p_audience_type = 'active_enrollment' then
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active' and u.status = 'active' and u.deleted_at is null;

  elsif p_audience_type in ('day_not_finalized', 'day_finalized') then
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      join public.challenges c on c.id = ce.challenge_id
      left join public.user_preferences up on up.user_id = u.id
      cross join lateral (select public.journey_get_local_date(u.timezone) as local_date) loc
      where ce.status = 'active'
        and c.status = 'active'
        and c.deleted_at is null
        and u.status = 'active'
        and u.deleted_at is null
        and (
          (
            p_audience_type = 'day_not_finalized'
            and not exists (
              select 1 from public.daily_logs dl
              where dl.enrollment_id = ce.id
                and dl.log_date = loc.local_date
                and dl.status = 'finalized'
            )
          )
          or (
            p_audience_type = 'day_finalized'
            and exists (
              select 1 from public.daily_logs dl
              where dl.enrollment_id = ce.id
                and dl.log_date = loc.local_date
                and dl.status = 'finalized'
            )
          )
        );

  elsif p_audience_type = 'push_enabled' then
    return query
      select true, u.id
      from public.users u
      join public.user_preferences up on up.user_id = u.id
      where u.status = 'active'
        and u.deleted_at is null
        and coalesce((up.notifications ->> 'push_enabled')::boolean, false)
        and exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        );

  elsif p_audience_type = 'push_disabled_internal_only' then
    return query
      select false, u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.status = 'active'
        and u.deleted_at is null
        and not (
          coalesce((up.notifications ->> 'push_enabled')::boolean, false)
          and exists (
            select 1 from public.push_subscriptions ps
            where ps.user_id = u.id and ps.revoked_at is null
          )
        );

  elsif p_audience_type = 'admins' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.role in ('admin', 'super_admin') and u.status = 'active' and u.deleted_at is null;

  elsif p_audience_type = 'super_admins' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.role = 'super_admin' and u.status = 'active' and u.deleted_at is null;

  else
    raise exception 'Publico invalido: %', p_audience_type using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.resolve_notification_audience(text, uuid, uuid) from public, anon;
grant execute on function public.resolve_notification_audience(text, uuid, uuid) to authenticated, service_role;

create or replace function public.admin_estimate_notification_audience(
  p_audience_type text,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null
)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  perform public.admin_require_admin();

  select count(*) into v_count
  from public.resolve_notification_audience(p_audience_type, p_challenge_id, p_specific_user_id);

  return v_count;
end;
$$;

revoke all on function public.admin_estimate_notification_audience(text, uuid, uuid) from public, anon;
grant execute on function public.admin_estimate_notification_audience(text, uuid, uuid) to authenticated;

-- ============================================================
-- Listagem (mesmo padrao de admin_list_challenges/admin_list_users)
-- ============================================================

create or replace function public.admin_list_notification_campaigns(
  p_search text default null,
  p_status text default null,
  p_sort_by text default 'created_at',
  p_sort_dir text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  audience_estimated_count integer,
  audience_type text,
  channel_internal boolean,
  channel_push boolean,
  clicked_count bigint,
  completed_at timestamptz,
  created_at timestamptz,
  created_by_name text,
  delivered_count bigint,
  failed_count bigint,
  id uuid,
  opened_count bigint,
  scheduled_for timestamptz,
  sent_count bigint,
  source text,
  status text,
  title text,
  total_count bigint,
  total_recipients bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sort_by text := lower(coalesce(p_sort_by, 'created_at'));
  v_sort_dir text := lower(coalesce(p_sort_dir, 'desc'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.admin_require_admin();

  if v_sort_by not in ('created_at', 'scheduled_for', 'title', 'status') then
    v_sort_by := 'created_at';
  end if;

  if v_sort_dir not in ('asc', 'desc') then
    v_sort_dir := 'desc';
  end if;

  return query execute format(
    $q$
      select
        nc.audience_estimated_count,
        nc.audience_type,
        nc.channel_internal,
        nc.channel_push,
        coalesce(stats.clicked_count, 0) as clicked_count,
        nc.completed_at,
        nc.created_at,
        u.display_name as created_by_name,
        coalesce(stats.delivered_count, 0) as delivered_count,
        coalesce(stats.failed_count, 0) as failed_count,
        nc.id,
        coalesce(stats.opened_count, 0) as opened_count,
        nc.scheduled_for,
        coalesce(stats.sent_count, 0) as sent_count,
        nc.source,
        nc.status,
        nc.title,
        count(*) over() as total_count,
        coalesce(stats.total_recipients, 0) as total_recipients
      from public.notification_campaigns nc
      left join public.users u on u.id = nc.created_by
      left join lateral (
        select
          count(*) as total_recipients,
          count(*) filter (where nd.status in ('sent', 'delivered', 'opened', 'read', 'clicked')) as sent_count,
          count(*) filter (where nd.status = 'failed') as failed_count,
          count(*) filter (where nd.opened_at is not null) as opened_count,
          count(*) filter (where nd.clicked_at is not null) as clicked_count,
          count(*) filter (where nd.status in ('sent', 'delivered', 'opened', 'read', 'clicked')) as delivered_count
        from public.notification_deliveries nd
        where nd.campaign_id = nc.id
      ) stats on true
      where (%L::text is null or nc.status = %L::text)
        and (
          %L::text is null
          or nc.title ilike '%%' || %L::text || '%%'
          or nc.message ilike '%%' || %L::text || '%%'
        )
      order by %I %s nulls last, nc.id asc
      limit %L
      offset %L
    $q$,
    p_status, p_status,
    nullif(trim(coalesce(p_search, '')), ''), nullif(trim(coalesce(p_search, '')), ''), nullif(trim(coalesce(p_search, '')), ''),
    v_sort_by, v_sort_dir,
    v_limit, v_offset
  );
end;
$$;

revoke all on function public.admin_list_notification_campaigns(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_notification_campaigns(text, text, text, text, integer, integer) to authenticated;

-- ============================================================
-- CRUD / lifecycle
-- ============================================================

create or replace function public.admin_create_notification_campaign(
  p_title text,
  p_message text,
  p_destination_type text,
  p_audience_type text,
  p_destination_reference_id text default null,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_image_url text default null,
  p_action_label text default null,
  p_channel_internal boolean default true,
  p_channel_push boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  v_id uuid;
  v_estimate integer;
begin
  perform public.admin_require_admin();

  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 or length(p_title) > 120 then
    raise exception 'Titulo invalido.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_message, ''))) = 0 or length(p_message) > 500 then
    raise exception 'Mensagem invalida.' using errcode = '22023';
  end if;

  if not p_channel_internal and not p_channel_push then
    raise exception 'Selecione ao menos um canal.' using errcode = '22023';
  end if;

  select count(*) into v_estimate
  from public.resolve_notification_audience(p_audience_type, p_challenge_id, p_specific_user_id);

  insert into public.notification_campaigns (
    action_label, audience_estimated_count, audience_type, challenge_id, channel_internal,
    channel_push, created_by, destination_reference_id, destination_type, image_url, message,
    source, specific_user_id, status, title
  )
  values (
    nullif(trim(coalesce(p_action_label, '')), ''), v_estimate, p_audience_type, p_challenge_id,
    p_channel_internal, p_channel_push, actor_id, nullif(trim(coalesce(p_destination_reference_id, '')), ''),
    p_destination_type, nullif(trim(coalesce(p_image_url, '')), ''), p_message, 'admin', p_specific_user_id,
    'draft', p_title
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_create_notification_campaign(text, text, text, text, text, uuid, uuid, text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_create_notification_campaign(text, text, text, text, text, uuid, uuid, text, text, boolean, boolean) to authenticated;

create or replace function public.admin_update_notification_campaign(
  p_campaign_id uuid,
  p_title text,
  p_message text,
  p_destination_type text,
  p_audience_type text,
  p_destination_reference_id text default null,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_image_url text default null,
  p_action_label text default null,
  p_channel_internal boolean default true,
  p_channel_push boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_estimate integer;
begin
  perform public.admin_require_admin();

  select status into v_status from public.notification_campaigns where id = p_campaign_id for update;

  if v_status is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  if v_status <> 'draft' then
    raise exception 'Apenas campanhas em rascunho podem ser editadas.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 or length(p_title) > 120 then
    raise exception 'Titulo invalido.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_message, ''))) = 0 or length(p_message) > 500 then
    raise exception 'Mensagem invalida.' using errcode = '22023';
  end if;

  if not p_channel_internal and not p_channel_push then
    raise exception 'Selecione ao menos um canal.' using errcode = '22023';
  end if;

  select count(*) into v_estimate
  from public.resolve_notification_audience(p_audience_type, p_challenge_id, p_specific_user_id);

  update public.notification_campaigns
  set action_label = nullif(trim(coalesce(p_action_label, '')), ''),
      audience_estimated_count = v_estimate,
      audience_type = p_audience_type,
      challenge_id = p_challenge_id,
      channel_internal = p_channel_internal,
      channel_push = p_channel_push,
      destination_reference_id = nullif(trim(coalesce(p_destination_reference_id, '')), ''),
      destination_type = p_destination_type,
      image_url = nullif(trim(coalesce(p_image_url, '')), ''),
      message = p_message,
      specific_user_id = p_specific_user_id,
      title = p_title
  where id = p_campaign_id;
end;
$$;

revoke all on function public.admin_update_notification_campaign(uuid, text, text, text, text, text, uuid, uuid, text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_update_notification_campaign(uuid, text, text, text, text, text, uuid, uuid, text, text, boolean, boolean) to authenticated;

create or replace function public.admin_schedule_notification_campaign(
  p_campaign_id uuid,
  p_scheduled_for timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.admin_require_admin();

  if p_scheduled_for is null or p_scheduled_for <= now() then
    raise exception 'Data de agendamento precisa ser no futuro.' using errcode = '22023';
  end if;

  select status into v_status from public.notification_campaigns where id = p_campaign_id for update;

  if v_status is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  if v_status <> 'draft' then
    raise exception 'Apenas rascunhos podem ser agendados.' using errcode = '22023';
  end if;

  update public.notification_campaigns
  set scheduled_for = p_scheduled_for,
      status = 'scheduled'
  where id = p_campaign_id;
end;
$$;

revoke all on function public.admin_schedule_notification_campaign(uuid, timestamptz) from public, anon;
grant execute on function public.admin_schedule_notification_campaign(uuid, timestamptz) to authenticated;

-- Envio imediato so muda o status para 'processing' aqui (transicao
-- atomica com lock, mesma tecnica do processador em lote) - o trabalho de
-- verdade (criar deliveries, enviar pushes) acontece no backend em lotes,
-- nunca dentro desta unica chamada RPC (ver
-- notification-dispatch.service.ts).
create or replace function public.admin_start_notification_campaign_now(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.admin_require_admin();

  select status into v_status from public.notification_campaigns where id = p_campaign_id for update;

  if v_status is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  if v_status <> 'draft' then
    raise exception 'Apenas rascunhos podem ser enviados agora.' using errcode = '22023';
  end if;

  update public.notification_campaigns
  set started_at = now(),
      status = 'processing'
  where id = p_campaign_id;
end;
$$;

revoke all on function public.admin_start_notification_campaign_now(uuid) from public, anon;
grant execute on function public.admin_start_notification_campaign_now(uuid) to authenticated;

create or replace function public.admin_cancel_notification_campaign(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  v_status text;
begin
  perform public.admin_require_admin();

  select status into v_status from public.notification_campaigns where id = p_campaign_id for update;

  if v_status is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  if v_status not in ('scheduled', 'draft') then
    raise exception 'Apenas campanhas agendadas ou em rascunho podem ser canceladas.' using errcode = '22023';
  end if;

  update public.notification_campaigns
  set cancelled_at = now(),
      cancelled_by = actor_id,
      status = 'cancelled'
  where id = p_campaign_id;
end;
$$;

revoke all on function public.admin_cancel_notification_campaign(uuid) from public, anon;
grant execute on function public.admin_cancel_notification_campaign(uuid) to authenticated;

create or replace function public.admin_delete_notification_campaign_draft(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  perform public.admin_require_admin();

  select status into v_status from public.notification_campaigns where id = p_campaign_id for update;

  if v_status is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  if v_status <> 'draft' then
    raise exception 'Apenas rascunhos podem ser excluidos.' using errcode = '22023';
  end if;

  delete from public.notification_campaigns where id = p_campaign_id;
end;
$$;

revoke all on function public.admin_delete_notification_campaign_draft(uuid) from public, anon;
grant execute on function public.admin_delete_notification_campaign_draft(uuid) to authenticated;

create or replace function public.admin_duplicate_notification_campaign(p_campaign_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  v_new_id uuid;
begin
  perform public.admin_require_admin();

  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  insert into public.notification_campaigns (
    action_label, audience_estimated_count, audience_type, challenge_id, channel_internal,
    channel_push, created_by, destination_reference_id, destination_type, image_url, message,
    source, specific_user_id, status, title
  )
  select
    action_label, audience_estimated_count, audience_type, challenge_id, channel_internal,
    channel_push, actor_id, destination_reference_id, destination_type, image_url,
    message, 'admin', specific_user_id, 'draft', title || ' (cópia)'
  from public.notification_campaigns
  where id = p_campaign_id
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  return v_new_id;
end;
$$;

revoke all on function public.admin_duplicate_notification_campaign(uuid) from public, anon;
grant execute on function public.admin_duplicate_notification_campaign(uuid) to authenticated;

create or replace function public.admin_get_notification_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform public.admin_require_admin();

  select jsonb_build_object(
    'id', nc.id,
    'title', nc.title,
    'message', nc.message,
    'image_url', nc.image_url,
    'action_label', nc.action_label,
    'destination_type', nc.destination_type,
    'destination_reference_id', nc.destination_reference_id,
    'audience_type', nc.audience_type,
    'audience_estimated_count', nc.audience_estimated_count,
    'challenge_id', nc.challenge_id,
    'specific_user_id', nc.specific_user_id,
    'channel_internal', nc.channel_internal,
    'channel_push', nc.channel_push,
    'status', nc.status,
    'scheduled_for', nc.scheduled_for,
    'started_at', nc.started_at,
    'completed_at', nc.completed_at,
    'created_at', nc.created_at,
    'created_by_name', u.display_name,
    'source', nc.source,
    'automation_type', nc.automation_type,
    'metrics', jsonb_build_object(
      'total_recipients', coalesce(stats.total_recipients, 0),
      'sent_count', coalesce(stats.sent_count, 0),
      'failed_count', coalesce(stats.failed_count, 0),
      'opened_count', coalesce(stats.opened_count, 0),
      'read_count', coalesce(stats.read_count, 0),
      'clicked_count', coalesce(stats.clicked_count, 0)
    ),
    'failures', coalesce(failures.items, '[]'::jsonb)
  )
  into v_result
  from public.notification_campaigns nc
  left join public.users u on u.id = nc.created_by
  left join lateral (
    select
      count(*) as total_recipients,
      count(*) filter (where nd.status in ('sent', 'delivered', 'opened', 'read', 'clicked')) as sent_count,
      count(*) filter (where nd.status = 'failed') as failed_count,
      count(*) filter (where nd.opened_at is not null) as opened_count,
      count(*) filter (where nd.read_at is not null) as read_count,
      count(*) filter (where nd.clicked_at is not null) as clicked_count
    from public.notification_deliveries nd
    where nd.campaign_id = nc.id
  ) stats on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'user_id', nd.user_id,
        'failure_code', nd.failure_code,
        'retry_count', nd.retry_count
      )
    ) as items
    from public.notification_deliveries nd
    where nd.campaign_id = nc.id and nd.status = 'failed'
    limit 50
  ) failures on true
  where nc.id = p_campaign_id;

  if v_result is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.admin_get_notification_campaign(uuid) from public, anon;
grant execute on function public.admin_get_notification_campaign(uuid) to authenticated;
