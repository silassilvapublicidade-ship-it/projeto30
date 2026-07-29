-- Fase 4: catalogo de desafios - participar de um desafio especifico
-- (em vez de "o primeiro disponivel") e leitura de desafios para o
-- catalogo/historico do membro.
--
-- Nao altera join_available_challenge(), finalize_daily_log(), pontuacao,
-- streak ou o indice unico de "uma inscricao ativa por usuario"
-- (challenge_enrollments_one_active_per_user, de 0002_daily_journey_core.sql)
-- - essa regra continua sendo o guarda-costas real contra corrida de
-- inscricoes simultaneas, mesmo que a checagem em plpgsql abaixo falhe por
-- qualquer motivo.

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
  existing_enrollment record;
  target_challenge record;
  created_enrollment_id uuid;
  existing_enrollment_id uuid;
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

  select ce.id, ce.challenge_id
  into existing_enrollment
  from public.challenge_enrollments ce
  where ce.user_id = actor_id
    and ce.status in ('active', 'paused')
  order by ce.joined_at desc
  limit 1;

  if existing_enrollment.id is not null then
    if existing_enrollment.challenge_id = target_challenge_id then
      -- Ja inscrito neste mesmo desafio: idempotente, apenas devolve.
      return existing_enrollment.id;
    end if;

    -- Regra de produto desta fase: um unico desafio ativo por vez.
    raise exception 'Voce ja esta participando de outro desafio ativo.'
      using errcode = 'P0004';
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

  -- Corrida rara: outra inscricao ativa foi criada entre a checagem acima e o
  -- insert (bloqueada pelo indice unico). Devolve o estado real em vez de
  -- fingir sucesso.
  select id
  into existing_enrollment_id
  from public.challenge_enrollments
  where user_id = actor_id
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

-- Leitura de desafios para o catalogo e o historico do membro. A politica
-- existente ("Anyone can read active challenges") continua cobrindo o caso
-- comum (desafio ativo, visitante ou membro). As duas novas cobrem:
--   1. desafios encerrados, para aparecerem como "Encerrado" ao explorar;
--   2. qualquer desafio em que o proprio usuario tenha (ou teve) inscricao,
--      mesmo que o status atual do desafio nao seja mais 'active' (por
--      exemplo, arquivado depois de concluido) - o historico do usuario nao
--      pode sumir por uma mudanca administrativa depois do fato.
-- Nenhuma das duas expoe desafios em rascunho/pausados/arquivados que o
-- usuario nunca participou.
create policy "Authenticated users can read ended challenges"
  on public.challenges for select
  to authenticated
  using (status = 'ended' and deleted_at is null);

create policy "Users can read challenges they are enrolled in"
  on public.challenges for select
  to authenticated
  using (
    exists (
      select 1
      from public.challenge_enrollments ce
      where ce.challenge_id = challenges.id
        and ce.user_id = auth.uid()
    )
  );
