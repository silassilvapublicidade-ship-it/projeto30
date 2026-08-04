-- Dashboard como alma do app (Parte A/B) + Timeline mais rica (Parte C).
--
-- AUDITORIA PREVIA:
-- - "Sua missao de hoje" (Parte A) reaproveita getMemberContext() (ja usado
--   por Hoje) inteiramente no lado da aplicacao - challenge_days.message ja
--   vem junto (todayChallengeDay.message), nenhuma consulta nova ali. So a
--   MENSAGEM MOTIVACIONAL de fallback (tier 2, "mensagem motivacional
--   ativa") precisa de uma via de leitura nova: daily_motivation_messages
--   so tem RLS de admin (mesma lacuna ja resolvida para "fe" em
--   member_pick_faith_message() na rodada anterior) - aqui o pool e
--   qualquer categoria ativa, com preferencia por NAO-fe primeiro (fe e a
--   ultima prioridade antes do fallback fixo, Parte A item 6).
-- - Timeline (Parte C): dois enriquecimentos no MESMO corpo de
--   member_profile_timeline (assinatura inalterada, create or replace):
--   (1) o branch day_finalized passa a trazer daily_logs.streak_at_finalize
--   (ja existe desde a rodada anterior) e um array_agg dos titulos de
--   habito CONCLUIDO naquele dia (join habit_logs+habits, uma soma por
--   linha via subquery correlacionada - nao adiciona nenhuma query nova por
--   evento, roda dentro da mesma consulta agregada);
--   (2) um novo tipo de evento 'halfway_reached', fonte analytics_events
--   (evento 'challenge_halfway_reached', ja disparado por
--   finalize_daily_log_with_responses desde 0037, e ja com a duplicata de
--   reentrada corrigida em 0035 - reaproveitado em vez de recalcular "qual
--   e o dia da metade" no frontend ou aqui de novo).
--   card_type novos (colunas ausentes no schema, ex.: livro concluido, meta
--   semanal/mensal) ficam de fora desta rodada - documentado como pendencia
--   no relatorio, exatamente como a auditoria pediu (nao transformar dado
--   nao confiavel em historia oficial).

-- ============================================================
-- 1. member_pick_daily_mission_message()
-- ============================================================

create or replace function public.member_pick_daily_mission_message()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('body', body, 'title', title)
    from public.daily_motivation_messages
    where active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    -- Nao-fe primeiro (tier 2 do briefing), fe por ultimo antes do fallback
    -- fixo (tier 3) - uma unica consulta ja resolve as duas prioridades via
    -- ordenacao, sem duas idas ao banco.
    order by (category <> 'fe') desc, priority desc, random()
    limit 1
  ) end;
$$;

revoke all on function public.member_pick_daily_mission_message() from public, anon;
grant execute on function public.member_pick_daily_mission_message() to authenticated;

comment on function public.member_pick_daily_mission_message() is
  'Mensagem motivacional do bloco "Sua missao de hoje" (Dashboard) quando o '
  'dia do desafio nao tem challenge_days.message proprio. Prioriza '
  'categorias fora de "fe", cai para "fe" por ultimo antes do fallback fixo '
  'no frontend. Reaproveita daily_motivation_messages (Modulo G), nunca uma '
  'tabela nova.';

-- ============================================================
-- 2. member_profile_timeline - habit_titles + streak no dia finalizado,
--    novo tipo halfway_reached (mesma assinatura, so o corpo muda)
-- ============================================================

create or replace function public.member_profile_timeline(
  p_challenge_id uuid default null,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20,
  p_types text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_items jsonb;
  v_has_more boolean;
  v_next_at timestamptz;
  v_next_id uuid;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  with events as (
    select
      'day_finalized'::text as event_type,
      dl.finalized_at as event_at,
      dl.id as event_source_id,
      dl.enrollment_id,
      ce.challenge_id,
      c.name as challenge_name,
      cd.day_number,
      dl.points_earned as points,
      dl.completion_percent,
      null::text as achievement_name,
      null::text as achievement_icon,
      null::text as achievement_rarity,
      null::text as achievement_slug,
      dl.streak_at_finalize as streak_value,
      (
        select array_agg(h.title order by h.sort_order)
        from public.habit_logs hl
        join public.habits h on h.id = hl.habit_id
        where hl.daily_log_id = dl.id and hl.status = 'completed'
      ) as habit_titles
    from public.daily_logs dl
    join public.challenge_enrollments ce on ce.id = dl.enrollment_id
    join public.challenges c on c.id = ce.challenge_id
    join public.challenge_days cd on cd.id = dl.challenge_day_id
    where ce.user_id = actor_id and dl.status = 'finalized'

    union all

    select
      'achievement_unlocked',
      ua.unlocked_at,
      ua.id,
      ua.enrollment_id,
      ua.challenge_id,
      c.name,
      null,
      a.points_bonus,
      null,
      a.name,
      a.icon,
      a.rarity,
      a.slug,
      null,
      null
    from public.user_achievements ua
    join public.achievements a on a.id = ua.achievement_id
    join public.challenges c on c.id = ua.challenge_id
    where ua.user_id = actor_id

    union all

    select
      'challenge_started',
      ce.joined_at,
      ce.id,
      ce.id,
      ce.challenge_id,
      c.name,
      null, null, null, null, null, null, null, null, null
    from public.challenge_enrollments ce
    join public.challenges c on c.id = ce.challenge_id
    where ce.user_id = actor_id

    union all

    select
      'challenge_completed',
      ce.completed_at,
      ce.id,
      ce.id,
      ce.challenge_id,
      c.name,
      null, null, null, null, null, null, null, null, null
    from public.challenge_enrollments ce
    join public.challenges c on c.id = ce.challenge_id
    where ce.user_id = actor_id and ce.completed_at is not null

    union all

    select
      'challenge_abandoned',
      ce.abandoned_at,
      ce.id,
      ce.id,
      ce.challenge_id,
      c.name,
      null, null, null, null, null, null, null, null, null
    from public.challenge_enrollments ce
    join public.challenges c on c.id = ce.challenge_id
    where ce.user_id = actor_id and ce.abandoned_at is not null

    union all

    select
      'streak_record',
      dl.finalized_at,
      dl.id,
      dl.enrollment_id,
      ce.challenge_id,
      c.name,
      cd.day_number,
      dl.points_earned,
      dl.completion_percent,
      null, null, null, null,
      dl.streak_at_finalize,
      null
    from public.daily_logs dl
    join public.challenge_enrollments ce on ce.id = dl.enrollment_id
    join public.challenges c on c.id = ce.challenge_id
    join public.challenge_days cd on cd.id = dl.challenge_day_id
    where ce.user_id = actor_id
      and dl.status = 'finalized'
      and dl.streak_at_finalize is not null
      and dl.streak_at_finalize > coalesce((
        select max(dl2.streak_at_finalize)
        from public.daily_logs dl2
        where dl2.enrollment_id = dl.enrollment_id
          and dl2.status = 'finalized'
          and dl2.streak_at_finalize is not null
          and dl2.log_date < dl.log_date
      ), 0)

    union all

    -- Reaproveita o evento 'challenge_halfway_reached' ja disparado (e
    -- deduplicado desde 0035) por finalize_daily_log_with_responses - nunca
    -- recalcula "qual e o dia da metade" aqui. distinct on garante no
    -- maximo 1 evento por inscricao mesmo se uma linha legada duplicada
    -- existir.
    select distinct on (ae.enrollment_id)
      'halfway_reached',
      ae.occurred_at,
      ae.id,
      ae.enrollment_id,
      ae.challenge_id,
      c.name,
      null, null, null, null, null, null, null, null, null
    from public.analytics_events ae
    join public.challenges c on c.id = ae.challenge_id
    where ae.user_id = actor_id
      and ae.event_name = 'challenge_halfway_reached'
      and ae.enrollment_id is not null
    order by ae.enrollment_id, ae.occurred_at asc
  ),
  filtered as (
    select *, count(*) over () as total_filtered
    from events
    where event_at is not null
      and (p_challenge_id is null or challenge_id = p_challenge_id)
      and (p_types is null or event_type = any(p_types))
      and (
        p_cursor_at is null
        or event_at < p_cursor_at
        or (event_at = p_cursor_at and p_cursor_id is not null and event_source_id < p_cursor_id)
      )
    order by event_at desc, event_source_id desc
    limit v_limit + 1
  ),
  page as (
    select * from filtered order by event_at desc, event_source_id desc limit v_limit
  ),
  next_cursor as (
    select event_at, event_source_id
    from page
    order by event_at asc, event_source_id asc
    limit 1
  )
  select
    (select coalesce(jsonb_agg(to_jsonb(page) - 'total_filtered' order by page.event_at desc, page.event_source_id desc), '[]'::jsonb) from page),
    (select coalesce(bool_or(page.total_filtered > v_limit), false) from page),
    (select event_at from next_cursor),
    (select event_source_id from next_cursor)
  into v_items, v_has_more, v_next_at, v_next_id;

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'nextCursorAt', case when v_has_more then v_next_at else null end,
    'nextCursorId', case when v_has_more then v_next_id else null end
  );
end;
$$;

comment on function public.member_profile_timeline(uuid, timestamptz, uuid, integer, text[]) is
  'Cursor composto (event_at, event_source_id). day_finalized agora traz '
  'streak_value (streak_at_finalize) e habit_titles (nomes dos habitos '
  'concluidos naquele dia, via array_agg correlacionado - zero queries '
  'extras por evento). Novo tipo halfway_reached reaproveita o evento de '
  'analytics ja disparado e deduplicado em finalize_daily_log_with_responses, '
  'nunca recalculado aqui.';

-- ============================================================
-- 3. analytics_events - 8 novos eventos desta rodada
-- ============================================================

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
      'share_template_previewed'
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
    'share_template_previewed'
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
