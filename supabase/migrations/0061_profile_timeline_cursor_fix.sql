-- Fix real, encontrado ao validar 0060 com dados reais (leitura, conta do
-- Silas): member_profile_timeline() referenciava a CTE "page" dentro da
-- expressao do RETURN final, mas "page" so existe dentro do escopo do
-- comando "with ... select into" anterior - um comando SQL novo (mesmo que
-- seja so o RETURN) nao enxerga CTEs de um comando anterior em PL/pgSQL.
-- Erro real observado: "relation "page" does not exist". Corrige lendo
-- nextCursor para uma variavel PL/pgSQL dentro do MESMO comando que ja
-- populava v_items/v_has_more, exatamente como o restante da funcao ja
-- fazia. Nenhuma outra linha muda - mesma logica de paginacao, mesmos 6
-- tipos de evento.

create or replace function public.member_profile_timeline(
  p_challenge_id uuid default null,
  p_cursor timestamptz default null,
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
  v_next_cursor timestamptz;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  with events as (
    select
      'day_finalized'::text as event_type,
      dl.finalized_at as event_at,
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
      null::integer as streak_value
    from public.daily_logs dl
    join public.challenge_enrollments ce on ce.id = dl.enrollment_id
    join public.challenges c on c.id = ce.challenge_id
    join public.challenge_days cd on cd.id = dl.challenge_day_id
    where ce.user_id = actor_id and dl.status = 'finalized'

    union all

    select
      'achievement_unlocked',
      ua.unlocked_at,
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
      ce.challenge_id,
      c.name,
      null, null, null, null, null, null, null, null
    from public.challenge_enrollments ce
    join public.challenges c on c.id = ce.challenge_id
    where ce.user_id = actor_id

    union all

    select
      'challenge_completed',
      ce.completed_at,
      ce.id,
      ce.challenge_id,
      c.name,
      null, null, null, null, null, null, null, null
    from public.challenge_enrollments ce
    join public.challenges c on c.id = ce.challenge_id
    where ce.user_id = actor_id and ce.completed_at is not null

    union all

    select
      'challenge_abandoned',
      ce.abandoned_at,
      ce.id,
      ce.challenge_id,
      c.name,
      null, null, null, null, null, null, null, null
    from public.challenge_enrollments ce
    join public.challenges c on c.id = ce.challenge_id
    where ce.user_id = actor_id and ce.abandoned_at is not null

    union all

    select
      'streak_record',
      dl.finalized_at,
      dl.enrollment_id,
      ce.challenge_id,
      c.name,
      cd.day_number,
      dl.points_earned,
      dl.completion_percent,
      null, null, null, null,
      dl.streak_at_finalize
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
  ),
  filtered as (
    select *, count(*) over () as total_filtered
    from events
    where event_at is not null
      and (p_challenge_id is null or challenge_id = p_challenge_id)
      and (p_types is null or event_type = any(p_types))
      and (p_cursor is null or event_at < p_cursor)
    order by event_at desc
    limit v_limit + 1
  ),
  page as (
    select * from filtered order by event_at desc limit v_limit
  )
  select
    coalesce(jsonb_agg(to_jsonb(page) - 'total_filtered' order by page.event_at desc), '[]'::jsonb),
    coalesce(bool_or(page.total_filtered > v_limit), false),
    min(page.event_at)
  into v_items, v_has_more, v_next_cursor
  from page;

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'nextCursor', case when v_has_more then v_next_cursor else null end
  );
end;
$$;

revoke all on function public.member_profile_timeline(uuid, timestamptz, integer, text[]) from public, anon;
grant execute on function public.member_profile_timeline(uuid, timestamptz, integer, text[]) to authenticated;

comment on function public.member_profile_timeline(uuid, timestamptz, integer, text[]) is
  'Fix de 0061: nextCursor agora e lido para uma variavel dentro do mesmo '
  'comando que populava items/hasMore - 0060 tentava reler a CTE "page" '
  'num comando RETURN separado, o que sempre falhava em runtime '
  '("relation page does not exist"). Mesma logica de paginacao/uniao de '
  'eventos de 0060, sem nenhuma outra mudanca.';
