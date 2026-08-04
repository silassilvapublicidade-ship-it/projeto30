-- Dashboard de Evolucao Pessoal (Perfil) - Parte 2/3.
--
-- AUDITORIA (antes de criar qualquer RPC): challenge_enrollments ja guarda
-- streak_current/streak_best/points_total/completion_percent por inscricao
-- (colunas diretas, sem agregacao) - member_profile_overview() so soma/
-- agrega esses valores JA CALCULADOS entre as varias inscricoes do usuario,
-- nunca recalcula streak/pontos do zero. Nenhuma metrica nova e inventada:
-- toda contagem aqui vem de linhas reais (daily_logs.status='finalized',
-- user_achievements, habit_logs.status='completed' por habits.habit_type/
-- category ja usados pelo motor de conquistas em achievements.service.ts -
-- mesmas categorias, nao uma nova classificacao).
--
-- Duas funcoes, ambas security definer + auth.uid() interno (nunca um id
-- vindo do cliente, mesmo padrao de toda RPC de journey/finalize) e SEMPRE
-- filtrando explicitamente por user_id = actor_id em cada subquery - nunca
-- dependendo de RLS (que tem a policy "user_id = auth.uid() or is_admin()",
-- a mesma armadilha de bypass para admin ja documentada neste projeto).
--
-- 1. member_profile_overview(): uma unica chamada agregada para o
--    cabecalho + resumo + "meus desafios" (Partes 3/4/6) - nunca N+1 de
--    contagens separadas do cliente.
-- 2. member_profile_timeline(): paginada por cursor (event_at), com filtro
--    opcional por tipo/desafio - nunca traz o dataset completo (Parte 17).
--    Uniao de 6 fontes de evento reais: dia finalizado, conquista
--    desbloqueada, desafio iniciado/concluido/abandonado, e novo recorde de
--    sequencia (usando daily_logs.streak_at_finalize da migration 0059 -
--    so aparece para finalizacoes feitas a partir de agora, documentado).

create or replace function public.member_profile_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  v_result jsonb;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'joinedAt', (
      select min(ce.joined_at) from public.challenge_enrollments ce where ce.user_id = actor_id
    ),
    'totals', jsonb_build_object(
      'daysFinalized', coalesce((
        select count(*)
        from public.daily_logs dl
        join public.challenge_enrollments ce on ce.id = dl.enrollment_id
        where ce.user_id = actor_id and dl.status = 'finalized'
      ), 0),
      'daysAt100', coalesce((
        select count(*)
        from public.daily_logs dl
        join public.challenge_enrollments ce on ce.id = dl.enrollment_id
        where ce.user_id = actor_id and dl.status = 'finalized' and dl.completion_percent = 100
      ), 0),
      'pointsTotal', coalesce((
        select sum(ce.points_total) from public.challenge_enrollments ce where ce.user_id = actor_id
      ), 0),
      'streakCurrentMax', coalesce((
        select max(ce.streak_current)
        from public.challenge_enrollments ce
        where ce.user_id = actor_id and ce.status in ('active', 'paused')
      ), 0),
      'streakBestMax', coalesce((
        select max(ce.streak_best) from public.challenge_enrollments ce where ce.user_id = actor_id
      ), 0),
      'achievementsUnlocked', coalesce((
        select count(*) from public.user_achievements ua where ua.user_id = actor_id
      ), 0),
      'challengesCompleted', coalesce((
        select count(*) from public.challenge_enrollments ce where ce.user_id = actor_id and ce.status = 'completed'
      ), 0),
      'challengesActive', coalesce((
        select count(*) from public.challenge_enrollments ce where ce.user_id = actor_id and ce.status = 'active'
      ), 0),
      -- Checks booleanos ja usados pelo motor de conquistas
      -- (achievements.service.ts / finalize_daily_log_with_responses) -
      -- mesmas categorias/tipos, nunca uma classificacao nova inventada
      -- aqui. Nao ha coluna de quantidade real (litros, paginas, minutos)
      -- em nenhum habito hoje - por isso so contagens de dias com check
      -- concluido, nunca uma quantidade fabricada.
      'readingDays', coalesce((
        select count(distinct hl.daily_log_id)
        from public.habit_logs hl
        join public.daily_logs dl on dl.id = hl.daily_log_id
        join public.challenge_enrollments ce on ce.id = dl.enrollment_id
        join public.habits h on h.id = hl.habit_id
        where ce.user_id = actor_id and hl.status = 'completed' and h.habit_type = 'reading'
      ), 0),
      'physicalActivityDays', coalesce((
        select count(distinct hl.daily_log_id)
        from public.habit_logs hl
        join public.daily_logs dl on dl.id = hl.daily_log_id
        join public.challenge_enrollments ce on ce.id = dl.enrollment_id
        join public.habits h on h.id = hl.habit_id
        where ce.user_id = actor_id
          and hl.status = 'completed'
          and (
            lower(coalesce(h.category, '')) in ('corpo', 'atividade fisica', 'atividade física', 'fisico', 'físico')
            or lower(coalesce(h.icon, '')) in ('activity', 'dumbbell', 'run', 'footprints')
          )
      ), 0),
      'reflectionDays', coalesce((
        select count(*)
        from public.journal_entries je
        join public.daily_logs dl on dl.id = je.daily_log_id
        join public.challenge_enrollments ce on ce.id = dl.enrollment_id
        where ce.user_id = actor_id and public.journey_has_journal_content(je)
      ), 0)
    ),
    'enrollments', coalesce((
      select jsonb_agg(
        row_to_json(e) order by e.status_rank, e.joined_at desc
      )
      from (
        select
          ce.id as enrollment_id,
          ce.challenge_id,
          c.name as challenge_name,
          c.slug as challenge_slug,
          c.duration_days,
          c.cover_image_url,
          ce.status,
          ce.current_day,
          ce.completion_percent,
          ce.streak_current,
          ce.streak_best,
          ce.points_total,
          ce.joined_at,
          ce.completed_at,
          ce.abandoned_at,
          ce.paused_at,
          (
            select count(*) from public.user_achievements ua2 where ua2.enrollment_id = ce.id
          ) as achievements_unlocked,
          case ce.status
            when 'active' then 0
            when 'paused' then 1
            when 'completed' then 2
            when 'restarted' then 3
            else 4
          end as status_rank
        from public.challenge_enrollments ce
        join public.challenges c on c.id = ce.challenge_id
        where ce.user_id = actor_id
      ) e
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.member_profile_overview() from public, anon;
grant execute on function public.member_profile_overview() to authenticated;

comment on function public.member_profile_overview() is
  'Agregacao unica para o Dashboard de Evolucao Pessoal (cabecalho + resumo '
  '+ meus desafios) - soma/conta colunas ja existentes, nunca recalcula '
  'streak/pontos. security definer + auth.uid() interno, nunca um id vindo '
  'do cliente; todo filtro e explicito por user_id (nunca depende de RLS, '
  'que faz bypass para admin).';

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
begin
  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  with events as (
    -- Dia finalizado.
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

    -- Conquista desbloqueada.
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

    -- Desafio iniciado.
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

    -- Desafio concluido.
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

    -- Desafio abandonado.
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

    -- Novo recorde de sequencia: so existe para finalizacoes feitas a
    -- partir da migration 0059 (streak_at_finalize nunca foi
    -- retroativamente preenchido - ver comentario naquela migration).
    -- "Recorde" aqui = maior streak_at_finalize ja visto ATE este dia,
    -- desta mesma inscricao - comparacao com o proprio historico real,
    -- nunca reconstruindo o algoritmo de streak.
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
    coalesce(bool_or(page.total_filtered > v_limit), false)
  into v_items, v_has_more
  from page;

  return jsonb_build_object(
    'items', v_items,
    'hasMore', v_has_more,
    'nextCursor', case
      when v_has_more then (select min(event_at) from page)
      else null
    end
  );
end;
$$;

revoke all on function public.member_profile_timeline(uuid, timestamptz, integer, text[]) from public, anon;
grant execute on function public.member_profile_timeline(uuid, timestamptz, integer, text[]) to authenticated;

comment on function public.member_profile_timeline(uuid, timestamptz, integer, text[]) is
  'Timeline paginada por cursor (event_at desc) para o Dashboard de '
  'Evolucao Pessoal - uniao de 6 fontes reais (dia finalizado, conquista '
  'desbloqueada, desafio iniciado/concluido/abandonado, novo recorde de '
  'sequencia). Nunca traz o dataset completo: limit+1 decide hasMore, '
  'nextCursor e o event_at do ultimo item da pagina. security definer + '
  'auth.uid() interno, filtro explicito por user_id em cada branch.';
