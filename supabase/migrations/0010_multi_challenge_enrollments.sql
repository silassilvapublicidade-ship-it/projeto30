-- Fase 5: participacao simultanea em varios desafios.
--
-- Decisao de produto revertida: um usuario podia ter apenas um desafio
-- ativo/pausado por vez. Agora pode participar de varios desafios ao mesmo
-- tempo - a unica regra que continua valendo e "no maximo uma inscricao
-- aberta (active/paused) por usuario POR DESAFIO".
--
-- SCHEMA JA EXISTENTE (auditado antes de qualquer alteracao)
-- Duas restricoes unicas coexistiam desde fases anteriores:
--   1) challenge_enrollments_one_active_per_user_challenge
--      on (user_id, challenge_id) where status in ('active','paused')
--      - criada em 0001_initial_schema.sql. Essa e exatamente a regra que
--        continua valendo ("no maximo uma inscricao aberta por
--        user_id + challenge_id"). NAO precisa ser recriada - ja esta certa.
--   2) challenge_enrollments_one_active_per_user
--      on (user_id) where status in ('active','paused')
--      - criada em 0002_daily_journey_core.sql. Essa e o bloqueio GLOBAL
--        (um unico desafio ativo por usuario, independente de qual) que
--        esta fase remove.
--
-- Esta migration APENAS remove o indice (2). Nao apaga nenhuma linha de
-- challenge_enrollments, nao altera daily_logs/habit_logs/point_events/
-- user_achievements, nao toca em challenge_day_habits.
--
-- MOTOR JA COMPATIVEL (auditado, nao alterado por esta migration)
-- journey_recalculate_daily_log(), finalize_daily_log(), update_habit_log()
-- e ensure_today_daily_log() ja operam inteiramente escopados por
-- target_daily_log_id / target_enrollment_id, e todas as agregacoes de
-- pontos/streak/conquistas dentro de finalize_daily_log() filtram por
-- enrollment_id = daily_record.enrollment_id (nunca por user_id sozinho).
-- Ou seja, o motor de pontuacao/streak/finalizacao ja nao mistura progresso
-- entre desafios diferentes - a unica coisa que impedia multiplos desafios
-- simultaneos era o indice (2) e as checagens equivalentes dentro das RPCs
-- de adesao (corrigidas abaixo).
drop index if exists public.challenge_enrollments_one_active_per_user;

-- join_available_challenge(): antes, se o usuario ja tivesse QUALQUER
-- inscricao ativa/pausada, a funcao devolvia essa inscricao em vez de
-- avaliar um novo desafio disponivel. Agora ela so devolve uma inscricao
-- existente se ela for do MESMO desafio escolhido; caso contrario, tenta
-- inscrever em um desafio disponivel que o usuario ainda nao tenha aberto.
create or replace function public.join_available_challenge()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  available_challenge_id uuid;
  existing_enrollment_id uuid;
  local_date date;
  profile_timezone text;
  created_enrollment_id uuid;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para participar do ciclo.'
      using errcode = '42501';
  end if;

  select timezone
  into profile_timezone
  from public.users
  where id = actor_id
    and status = 'active'
    and deleted_at is null
  for update;

  if profile_timezone is null then
    raise exception 'Perfil ativo nao encontrado.'
      using errcode = '42501';
  end if;

  local_date := public.journey_get_local_date(profile_timezone);

  select c.id
  into available_challenge_id
  from public.challenges c
  where c.status = 'active'
    and c.deleted_at is null
    and (c.enrollment_start is null or c.enrollment_start <= local_date)
    and (c.enrollment_end is null or c.enrollment_end >= local_date)
    and not exists (
      select 1
      from public.challenge_enrollments ce
      where ce.user_id = actor_id
        and ce.challenge_id = c.id
        and ce.status in ('active', 'paused')
    )
  order by c.created_at asc
  limit 1;

  if available_challenge_id is null then
    raise exception 'Nenhum ciclo ativo disponivel agora.'
      using errcode = 'P0002';
  end if;

  insert into public.challenge_enrollments (
    user_id,
    challenge_id,
    personal_start_date
  )
  values (
    actor_id,
    available_challenge_id,
    local_date
  )
  on conflict do nothing
  returning id into created_enrollment_id;

  if created_enrollment_id is not null then
    return created_enrollment_id;
  end if;

  -- Corrida rara: outra sessao inscreveu o mesmo usuario neste mesmo
  -- desafio entre a checagem "not exists" e o insert (bloqueado pelo indice
  -- unico por user_id+challenge_id). Devolve o estado real.
  select id
  into existing_enrollment_id
  from public.challenge_enrollments
  where user_id = actor_id
    and challenge_id = available_challenge_id
    and status in ('active', 'paused')
  order by joined_at desc
  limit 1;

  if existing_enrollment_id is null then
    raise exception 'Nao foi possivel criar a participacao no ciclo.'
      using errcode = '23505';
  end if;

  return existing_enrollment_id;
end;
$$;

-- join_specific_challenge(): remove o bloqueio "voce ja esta participando
-- de outro desafio ativo" - inscrever-se em um desafio diferente agora e
-- permitido. A unica checagem de duplicidade que resta e para o MESMO
-- desafio (idempotente: devolve a inscricao existente em vez de duplicar).
create or replace function public.join_specific_challenge(
  target_challenge_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  local_date date;
  profile_timezone text;
  existing_enrollment_id uuid;
  target_challenge record;
  created_enrollment_id uuid;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para participar do desafio.'
      using errcode = '42501';
  end if;

  select timezone
  into profile_timezone
  from public.users
  where id = actor_id
    and status = 'active'
    and deleted_at is null
  for update;

  if profile_timezone is null then
    raise exception 'Perfil ativo nao encontrado.'
      using errcode = '42501';
  end if;

  local_date := public.journey_get_local_date(profile_timezone);

  select ce.id
  into existing_enrollment_id
  from public.challenge_enrollments ce
  where ce.user_id = actor_id
    and ce.challenge_id = target_challenge_id
    and ce.status in ('active', 'paused')
  order by ce.joined_at desc
  limit 1;

  if existing_enrollment_id is not null then
    -- Ja inscrito neste mesmo desafio: idempotente, apenas devolve.
    return existing_enrollment_id;
  end if;

  select c.id, c.duration_days
  into target_challenge
  from public.challenges c
  where c.id = target_challenge_id
    and c.status = 'active'
    and c.deleted_at is null
    and (c.enrollment_start is null or c.enrollment_start <= local_date)
    and (c.enrollment_end is null or c.enrollment_end >= local_date);

  if target_challenge.id is null then
    raise exception 'Este desafio nao esta disponivel para inscricao agora.'
      using errcode = 'P0002';
  end if;

  insert into public.challenge_enrollments (
    user_id,
    challenge_id,
    personal_start_date
  )
  values (
    actor_id,
    target_challenge_id,
    local_date
  )
  on conflict do nothing
  returning id into created_enrollment_id;

  if created_enrollment_id is not null then
    return created_enrollment_id;
  end if;

  -- Corrida rara: outra inscricao no MESMO desafio foi criada entre a
  -- checagem acima e o insert (bloqueada pelo indice unico por
  -- user_id+challenge_id). Devolve o estado real em vez de fingir sucesso.
  select id
  into existing_enrollment_id
  from public.challenge_enrollments
  where user_id = actor_id
    and challenge_id = target_challenge_id
    and status in ('active', 'paused')
  order by joined_at desc
  limit 1;

  if existing_enrollment_id is null then
    raise exception 'Nao foi possivel criar a participacao no desafio.'
      using errcode = '23505';
  end if;

  return existing_enrollment_id;
end;
$$;

revoke execute on function public.join_specific_challenge(uuid)
  from public, anon, authenticated;
grant execute on function public.join_specific_challenge(uuid)
  to authenticated;
