-- Bug real encontrado validando 0065 com dados reais (leitura, conta do
-- Silas): "missing FROM-clause entry for table ae". Causa: um ORDER BY no
-- final de uma cadeia UNION ALL, sem parenteses ao redor do SELECT que o
-- possui, liga-se ao resultado da UNION inteira (que so enxerga os nomes de
-- coluna de saida, nao os aliases de tabela dos ramos individuais) - nunca
-- apenas aquele SELECT. O branch halfway_reached usava
-- "select distinct on (ae.enrollment_id) ... order by ae.enrollment_id,
-- ae.occurred_at asc" como o ULTIMO ramo antes do fechamento do CTE
-- "events", entao esse ORDER BY (exigido pelo proprio DISTINCT ON) estava
-- sendo interpretado como pertencente a uniao inteira, onde "ae" nao
-- existe. Corrige envolvendo esse ramo entre parenteses, isolando seu
-- proprio ORDER BY/DISTINCT ON do restante da uniao - unica mudanca desta
-- migration, resto do corpo identico a 0065.

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
    -- existir. Envolto em parenteses (fix desta migration): sem eles, o
    -- ORDER BY abaixo (exigido pelo proprio DISTINCT ON) se ligaria a UNION
    -- inteira, onde o alias "ae" nao existe.
    (
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
    )
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
  'Cursor composto (event_at, event_source_id). day_finalized traz '
  'streak_value (streak_at_finalize) e habit_titles (array_agg '
  'correlacionado, zero queries extras por evento). halfway_reached '
  'reaproveita o evento de analytics ja disparado/deduplicado em '
  'finalize_daily_log_with_responses; seu ramo fica entre parenteses na '
  'UNION ALL para que o DISTINCT ON/ORDER BY internos nao vazem para a '
  'uniao inteira (bug corrigido em 0067).';
