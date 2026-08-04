-- Bug real encontrado validando 0061 com dados reais (leitura, conta do
-- Silas): um "dia finalizado" e a "conquista desbloqueada" que ele libera
-- no mesmo instante compartilham o EXATO mesmo event_at (now() e constante
-- durante toda a transacao de finalize_daily_log_with_responses - e o caso
-- comum, nao raro: toda finalizacao que desbloqueia 1+ conquistas produz
-- eventos com timestamp identico). Paginacao por cursor usando so
-- "event_at < cursor" pode DESCARTAR silenciosamente eventos empatados no
-- mesmo instante que caem exatamente na borda de uma pagina.
--
-- Corrige com um cursor composto (event_at, event_source_id) - cada evento
-- ja carrega o id da linha de origem (dl.id/ua.id/ce.id), reaproveitado
-- aqui so como desempate estavel, nunca com significado proprio. Ordenacao
-- e comparacao do cursor usam sempre a mesma dupla, garantindo que nenhuma
-- pagina pula ou repete um evento mesmo quando varios compartilham o
-- instante exato.

-- Assinatura antiga (0060/0061) tinha um parametro a menos (sem
-- p_cursor_id) - create or replace NUNCA substitui uma funcao com uma
-- lista de tipos de parametro diferente, so cria uma segunda sobrecarga
-- orfa (armadilha ja documentada neste projeto, ver 0055). Drop explicito
-- da assinatura antiga antes de criar a nova.
drop function if exists public.member_profile_timeline(uuid, timestamptz, integer, text[]);

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
      null, null, null, null, null, null, null, null
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
      null, null, null, null, null, null, null, null
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
      null, null, null, null, null, null, null, null
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
  -- Definida dentro do MESMO "with" (nunca um comando SQL separado - CTEs
  -- nao atravessam comandos em PL/pgSQL, exatamente o bug corrigido acima
  -- em 0061 e que quase se repetiu aqui). A ultima linha da pagina, em
  -- ordem crescente, e o cursor da proxima pagina.
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

revoke all on function public.member_profile_timeline(uuid, timestamptz, uuid, integer, text[]) from public, anon;
grant execute on function public.member_profile_timeline(uuid, timestamptz, uuid, integer, text[]) to authenticated;

comment on function public.member_profile_timeline(uuid, timestamptz, uuid, integer, text[]) is
  'Cursor composto (event_at, event_source_id) - corrige perda silenciosa '
  'de eventos empatados no mesmo instante (comum: dia finalizado + '
  'conquista desbloqueada na mesma transacao de finalize sempre '
  'compartilham event_at). Substitui a assinatura de 4 parametros de 0060/'
  '0061 (parametro novo p_cursor_id no meio da lista - drop explicito da '
  'assinatura antiga evita a armadilha de overload orfao ja documentada '
  'neste projeto, ver 0055).';
