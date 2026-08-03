-- Modulo G: Sistema Inteligente de Notificacoes Motivacionais e Lembretes.
-- Rodada 2/2: motor + segmentacao. Reaproveita resolve_notification_audience/
-- notification_campaigns/notification_deliveries - o unico codigo novo aqui
-- e "quem se qualifica" (novos audience_type + o resolver do motor
-- inteligente); o envio em si continua 100% em
-- notification-dispatch.service.ts (dispatchCampaignToAudience), sem
-- duplicacao.

-- ============================================================
-- 1. RLS: admin pode gerenciar challenge_habit_notifications diretamente
-- (mesmo padrao de notification_campaigns/daily_motivation_messages - nao
-- ha validacao cross-tabela complexa aqui que justifique uma RPC dedicada,
-- so o zod schema do lado TS).
-- ============================================================

drop policy if exists "Admins can manage habit notification config" on public.challenge_habit_notifications;
create policy "Admins can manage habit notification config"
  on public.challenge_habit_notifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 2. resolve_notification_audience: +4 audience_type, +2 parametros
-- ============================================================

create or replace function public.resolve_notification_audience(
  p_audience_type text,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_min_streak integer default null,
  p_habit_keyword text default null
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

  -- ============================================================
  -- Modulo G, Parte 11: novos publicos
  -- ============================================================

  elsif p_audience_type = 'streak_above_threshold' then
    if p_min_streak is null then
      return;
    end if;
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and u.status = 'active'
        and u.deleted_at is null
        and ce.streak_current >= p_min_streak;

  elsif p_audience_type = 'streak_lost' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and u.status = 'active'
        and u.deleted_at is null
        and ce.streak_current = 0
        and ce.streak_best > 0;

  elsif p_audience_type = 'day_all_habits_completed' then
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
      join public.challenge_days cd on cd.challenge_id = c.id and cd.day_number = ce.current_day
      join public.daily_logs dl on dl.enrollment_id = ce.id and dl.challenge_day_id = cd.id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and c.status = 'active'
        and c.deleted_at is null
        and u.status = 'active'
        and u.deleted_at is null
        and dl.completion_percent = 100;

  elsif p_audience_type = 'habit_keyword_not_completed_today' then
    if p_habit_keyword is null or length(trim(p_habit_keyword)) = 0 then
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
      join public.challenges c on c.id = ce.challenge_id
      join public.challenge_days cd on cd.challenge_id = c.id and cd.day_number = ce.current_day
      join public.challenge_day_habits cdh on cdh.challenge_day_id = cd.id
      join public.habits h on h.id = cdh.habit_id and h.active
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and c.status = 'active'
        and c.deleted_at is null
        and u.status = 'active'
        and u.deleted_at is null
        and (h.title ilike '%' || p_habit_keyword || '%' or h.category ilike '%' || p_habit_keyword || '%')
        and public.habit_visible_on_day(h.visibility_config, cd.day_number, c.duration_days)
        and not exists (
          select 1
          from public.daily_logs dl
          join public.habit_logs hl on hl.daily_log_id = dl.id and hl.habit_id = h.id
          where dl.enrollment_id = ce.id
            and dl.challenge_day_id = cd.id
            and hl.status = 'completed'
        );

  else
    raise exception 'Publico invalido: %', p_audience_type using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.resolve_notification_audience(text, uuid, uuid, integer, text) from public, anon;
grant execute on function public.resolve_notification_audience(text, uuid, uuid, integer, text) to authenticated, service_role;

comment on function public.resolve_notification_audience(text, uuid, uuid, integer, text) is
  'Modulo G adiciona streak_above_threshold/streak_lost/'
  'day_all_habits_completed/habit_keyword_not_completed_today e os '
  'parametros p_min_streak/p_habit_keyword que os alimentam. Todo audience '
  'type anterior (Modulo F) permanece identico.';

-- ============================================================
-- 3. Segmentacoes combinadas (Parte 11, ultimo item da lista): qualquer
-- audience_type + um filtro extra opcional de streak minimo, sem precisar
-- de um audience_type dedicado por combinacao.
-- ============================================================

create or replace function public.resolve_notification_audience_combined(
  p_audience_type text,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_min_streak integer default null,
  p_habit_keyword text default null,
  p_combined_min_streak integer default null
)
returns table (push_eligible boolean, user_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.push_eligible, r.user_id
  from public.resolve_notification_audience(p_audience_type, p_challenge_id, p_specific_user_id, p_min_streak, p_habit_keyword) r
  where p_combined_min_streak is null
    or exists (
      select 1
      from public.challenge_enrollments ce
      where ce.user_id = r.user_id
        and ce.status = 'active'
        and ce.streak_current >= p_combined_min_streak
    );
$$;

revoke all on function public.resolve_notification_audience_combined(text, uuid, uuid, integer, text, integer) from public, anon;
grant execute on function public.resolve_notification_audience_combined(text, uuid, uuid, integer, text, integer) to authenticated, service_role;

comment on function public.resolve_notification_audience_combined(text, uuid, uuid, integer, text, integer) is
  'Wrapper fino sobre resolve_notification_audience - p_combined_min_streak '
  'intersecta QUALQUER audience_type de base com "tem uma inscricao ativa '
  'com streak_current >= N", satisfazendo "segmentacoes combinadas" sem um '
  'motor de regras arbitrario. p_min_streak continua sendo o parametro '
  'proprio de streak_above_threshold (podem ser usados juntos ou nao).';

-- ============================================================
-- 4. Admin RPCs de campanha: threading dos 2 novos parametros +
-- persistencia das 2 novas colunas
-- ============================================================

create or replace function public.admin_estimate_notification_audience(
  p_audience_type text,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_min_streak integer default null,
  p_habit_keyword text default null
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
  from public.resolve_notification_audience_combined(
    p_audience_type, p_challenge_id, p_specific_user_id, p_min_streak, p_habit_keyword, null
  );

  return v_count;
end;
$$;

revoke all on function public.admin_estimate_notification_audience(text, uuid, uuid, integer, text) from public, anon;
grant execute on function public.admin_estimate_notification_audience(text, uuid, uuid, integer, text) to authenticated;

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
  p_channel_push boolean default true,
  p_min_streak_threshold integer default null,
  p_habit_keyword text default null
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
  from public.resolve_notification_audience_combined(
    p_audience_type, p_challenge_id, p_specific_user_id, p_min_streak_threshold, p_habit_keyword, null
  );

  insert into public.notification_campaigns (
    action_label, audience_estimated_count, audience_type, challenge_id, channel_internal,
    channel_push, created_by, destination_reference_id, destination_type, image_url, message,
    source, specific_user_id, status, title, min_streak_threshold, habit_keyword
  )
  values (
    nullif(trim(coalesce(p_action_label, '')), ''), v_estimate, p_audience_type, p_challenge_id,
    p_channel_internal, p_channel_push, actor_id, nullif(trim(coalesce(p_destination_reference_id, '')), ''),
    p_destination_type, nullif(trim(coalesce(p_image_url, '')), ''), p_message, 'admin', p_specific_user_id,
    'draft', p_title, p_min_streak_threshold, nullif(trim(coalesce(p_habit_keyword, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_create_notification_campaign(text, text, text, text, text, uuid, uuid, text, text, boolean, boolean, integer, text) from public, anon;
grant execute on function public.admin_create_notification_campaign(text, text, text, text, text, uuid, uuid, text, text, boolean, boolean, integer, text) to authenticated;

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
  p_channel_push boolean default true,
  p_min_streak_threshold integer default null,
  p_habit_keyword text default null
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
  from public.resolve_notification_audience_combined(
    p_audience_type, p_challenge_id, p_specific_user_id, p_min_streak_threshold, p_habit_keyword, null
  );

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
      title = p_title,
      min_streak_threshold = p_min_streak_threshold,
      habit_keyword = nullif(trim(coalesce(p_habit_keyword, '')), '')
  where id = p_campaign_id;
end;
$$;

revoke all on function public.admin_update_notification_campaign(uuid, text, text, text, text, text, uuid, uuid, text, text, boolean, boolean, integer, text) from public, anon;
grant execute on function public.admin_update_notification_campaign(uuid, text, text, text, text, text, uuid, uuid, text, text, boolean, boolean, integer, text) to authenticated;

-- admin_get_notification_campaign passa a devolver os 2 campos novos, para
-- o compositor conseguir reabrir um rascunho com a segmentacao exata que
-- foi salva.
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
    'min_streak_threshold', nc.min_streak_threshold,
    'habit_keyword', nc.habit_keyword,
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
      'clicked_count', coalesce(stats.clicked_count, 0),
      'cancelled_count', coalesce(stats.cancelled_count, 0),
      'pending_count', coalesce(stats.pending_count, 0)
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
      count(*) filter (where nd.clicked_at is not null) as clicked_count,
      count(*) filter (where nd.status = 'cancelled') as cancelled_count,
      count(*) filter (where nd.status = 'pending') as pending_count
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

-- ============================================================
-- 5. Motor inteligente: candidatos de lembrete de habito + motivacao diaria,
-- ja com a arbitragem de spam/prioridade da Parte 8 aplicada (1 vencedor
-- por usuario por chamada).
-- ============================================================

create or replace function public.automation_resolve_smart_notification_candidates(
  p_daily_motivation_message_id uuid default null,
  p_daily_motivation_title text default null,
  p_daily_motivation_body text default null,
  p_daily_motivation_category text default null
)
returns table (
  candidate_key text,
  destination_reference_id text,
  destination_type text,
  habit_id uuid,
  notification_body text,
  notification_title text,
  push_eligible boolean,
  user_id uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with habit_candidates as (
    select
      ce.user_id,
      ('habit:' || h.id::text) as candidate_key,
      h.id as habit_id,
      chn.notification_title as notification_title,
      chn.notification_body as notification_body,
      chn.priority as priority,
      'hoje'::text as destination_type,
      null::text as destination_reference_id,
      (
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = ce.user_id and ps.revoked_at is null
        )
        and coalesce((up.notifications ->> 'push_enabled')::boolean, false)
      ) as push_eligible
    from public.challenge_habit_notifications chn
    join public.habits h on h.id = chn.habit_id and h.active
    join public.challenge_day_habits cdh on cdh.habit_id = h.id
    join public.challenge_days cd on cd.id = cdh.challenge_day_id
    join public.challenges c on c.id = cd.challenge_id and c.status = 'active' and c.deleted_at is null
    join public.challenge_enrollments ce on ce.challenge_id = c.id and ce.status = 'active' and ce.current_day = cd.day_number
    join public.users u on u.id = ce.user_id and u.status = 'active' and u.deleted_at is null
    left join public.user_preferences up on up.user_id = u.id
    cross join lateral (
      select
        public.journey_get_local_date(u.timezone) as local_date,
        timezone(coalesce(nullif(u.timezone, ''), 'America/Sao_Paulo'), now()) as local_now
    ) loc
    where chn.enabled
      and coalesce((up.notifications ->> 'habit_reminders_enabled')::boolean, true)
      and public.habit_visible_on_day(h.visibility_config, cd.day_number, c.duration_days)
      -- Parte 6: nunca antes das 07:00 nem depois das 22:00, mesmo que o
      -- horario cadastrado esteja fora dessa janela.
      and extract(hour from loc.local_now) >= 7
      and extract(hour from loc.local_now) < 22
      -- o horario configurado ja chegou hoje
      and loc.local_now::time >= chn.notification_time
      -- Parte 7: frequencia (dia da semana ou dia do mes)
      and (
        (
          chn.frequency_type = 'weekly'
          and exists (
            select 1 from jsonb_array_elements_text(chn.weekdays) as w(value)
            where w.value::integer = extract(dow from loc.local_date)::integer
          )
        )
        or (
          chn.frequency_type = 'monthly'
          and chn.monthly_day = extract(day from loc.local_date)::integer
        )
      )
      -- Parte 5: nunca lembrar de um habito ja concluido hoje
      and (
        not chn.only_if_not_completed
        or not exists (
          select 1
          from public.daily_logs dl
          join public.habit_logs hl on hl.daily_log_id = dl.id and hl.habit_id = h.id
          where dl.enrollment_id = ce.id
            and dl.challenge_day_id = cd.id
            and hl.status = 'completed'
        )
      )
  ),
  motivation_candidates as (
    select
      ce.user_id,
      'motivation'::text as candidate_key,
      null::uuid as habit_id,
      p_daily_motivation_title as notification_title,
      p_daily_motivation_body as notification_body,
      5 as priority,
      'hoje'::text as destination_type,
      null::text as destination_reference_id,
      (
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = ce.user_id and ps.revoked_at is null
        )
        and coalesce((up.notifications ->> 'push_enabled')::boolean, false)
      ) as push_eligible
    from public.challenge_enrollments ce
    join public.users u on u.id = ce.user_id and u.status = 'active' and u.deleted_at is null
    left join public.user_preferences up on up.user_id = u.id
    cross join lateral (
      select timezone(coalesce(nullif(u.timezone, ''), 'America/Sao_Paulo'), now()) as local_now
    ) loc
    where ce.status = 'active'
      and p_daily_motivation_message_id is not null
      -- Parte 3: "pela manha" - a partir de 07:00 (nunca antes, Parte 6);
      -- sem um horario configuravel proprio no schema pedido, usa o mesmo
      -- inicio da janela global permitida.
      and extract(hour from loc.local_now) >= 7
      and extract(hour from loc.local_now) < 22
      and (
        (
          p_daily_motivation_category = 'fe'
          and coalesce((up.notifications ->> 'faith_messages_enabled')::boolean, true)
        )
        or (
          p_daily_motivation_category <> 'fe'
          and coalesce((up.notifications ->> 'daily_motivation_enabled')::boolean, true)
        )
      )
  ),
  all_candidates as (
    select * from habit_candidates
    union all
    select * from motivation_candidates
  ),
  -- Parte 8: nunca 2 notificacoes com menos de 60min de intervalo -
  -- qualquer usuario que ja recebeu um lembrete/motivacao automatico nos
  -- ultimos 60 minutos fica de fora desta rodada (tentado de novo no
  -- proximo tick do cron, que e o "reagendamento automatico").
  recently_notified as (
    select distinct n.user_id
    from public.notifications n
    where n.type in ('habit_reminder', 'daily_motivation')
      and n.sent_at >= now() - interval '60 minutes'
  ),
  ranked as (
    select
      ac.*,
      row_number() over (
        partition by ac.user_id
        order by ac.priority desc, ac.candidate_key asc
      ) as rn
    from all_candidates ac
    where not exists (
      select 1 from recently_notified rn2 where rn2.user_id = ac.user_id
    )
  )
  select
    candidate_key, destination_reference_id, destination_type, habit_id,
    notification_body, notification_title, push_eligible, user_id
  from ranked
  where rn = 1;
$$;

revoke all on function public.automation_resolve_smart_notification_candidates(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.automation_resolve_smart_notification_candidates(uuid, text, text, text) to service_role;

comment on function public.automation_resolve_smart_notification_candidates(uuid, text, text, text) is
  'Motor unico Parte 1+3+5+6+7+8: resolve, para cada usuario elegivel, no '
  'maximo 1 notificacao vencedora nesta chamada (lembrete de habito com '
  'maior prioridade OU a motivacao do dia), ja excluindo quem recebeu algo '
  'automatico nos ultimos 60 minutos. Chamada pelo cron via '
  'notification-automations.service.ts, nunca por um agendador paralelo.';
