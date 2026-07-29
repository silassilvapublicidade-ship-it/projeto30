-- Fase 5 (validacao ao vivo): corrige um problema real encontrado ao testar
-- join_available_challenge() apos a migration 0010.
--
-- PROBLEMA ENCONTRADO
-- A versao de join_available_challenge() criada em 0010 escolhia o desafio
-- elegivel com `order by c.created_at asc limit 1`. created_at nao e
-- garantidamente unico (dois desafios podem ser criados na mesma transacao/
-- mesmo timestamp), entao a selecao podia depender da ordem fisica de
-- armazenamento em caso de empate - nao e um ORDER BY deterministico.
--
-- CORRECAO
-- public.challenges nao tem nenhuma coluna de prioridade/display_order hoje
-- (auditado antes de alterar) - nao foi inventada nenhuma coluna nova so
-- para isto. A ordenacao passa a ser, em ordem:
--   1) start_date (ciclos com inicio programado mais cedo primeiro; nulls
--      por ultimo);
--   2) created_at (desempate natural, ordem de criacao);
--   3) id (desempate final, sempre unico, sempre deterministico).
-- Nao altera nenhuma outra regra da funcao (mesma checagem de not exists
-- por user_id+challenge_id, mesmo tratamento de corrida via indice unico,
-- mesmos codigos de erro).
--
-- Esta migration so redefine join_available_challenge(). Nao toca em
-- join_specific_challenge(), no indice de inscricoes, em challenge_day_habits,
-- em pontuacao, streak ou finalizacao.

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
  order by c.start_date asc nulls last, c.created_at asc, c.id asc
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
