-- Etapa B: "Abandonar desafio".
--
-- AUDITORIA (antes de escrever qualquer coisa):
--   - enrollment_status ja inclui 'abandoned' desde 0001 - nunca foi usado
--     por nenhuma RPC ate agora (nenhum UPDATE ... SET status = 'abandoned'
--     existia em lugar nenhum do projeto).
--   - challenge_enrollments NAO tem abandoned_at - precisa ser adicionada.
--   - challenge_enrollments_one_active_per_user_challenge (indice unico
--     parcial, 0001) so cobre status in ('active','paused') - depois de
--     abandonado, nada no BANCO impediria uma nova linha de enrollment para
--     o mesmo (user_id, challenge_id). A regra conservadora desta rodada
--     ("nao permitir nova inscricao no mesmo desafio apos abandono") precisa
--     ser aplicada explicitamente em join_specific_challenge/
--     join_available_challenge, nao existe de graca via constraint.
--   - ensure_today_daily_log, update_habit_log, finalize_daily_log e
--     save_journal_entry JA exigem enrollment_status = 'active' (checado em
--     todas as 4, ver 0002/0016/0017) - abandoned e' apenas mais um status
--     "nao ativo" para elas. NENHUMA dessas 4 funcoes precisa ser redefinida
--     para bloquear atividade num enrollment abandonado - o bloqueio ja e'
--     automatico. Confirmado por leitura completa de cada uma antes desta
--     migration.
--   - getMemberContext (Hoje) ja filtra .in("status", ["active","paused"]) -
--     um enrollment abandonado ja some de Hoje automaticamente, sem
--     mudanca de codigo.
--   - getMemberChallengeCatalog (catalogo) ja tem um filtro `history` que
--     inclui status === "abandoned", e describeEnrollmentStatus ja mapeia
--     'abandoned' -> "Abandonado". O catalogo/historico ja estava pronto
--     para este status.
--   - record_analytics_event ja aceita 'challenge_abandoned' como
--     event_name valido e ja o inclui no indice parcial de idempotencia de
--     milestones (enrollment_id, event_name) - chamar a funcao de novo para
--     o mesmo enrollment nunca duplica a linha, sem precisar de logica extra.
--
-- O QUE FALTA DE FATO (o que esta migration adiciona):
--   1) abandoned_at timestamptz nullable.
--   2) abandon_challenge_enrollment(uuid) - RPC transacional, idempotente,
--      travando a linha, validando ownership, aceitando somente
--      active/paused, preenchendo abandoned_at, registrando o evento.
--   3) join_specific_challenge - bloqueia com o novo errcode P0006 se ja
--      existir um enrollment 'abandoned' deste usuario para este desafio.
--   4) join_available_challenge - nunca oferece automaticamente um desafio
--      que o usuario ja abandonou.

alter table public.challenge_enrollments
  add column if not exists abandoned_at timestamptz;

comment on column public.challenge_enrollments.abandoned_at is
  'Preenchido por abandon_challenge_enrollment() quando status muda para '
  'abandoned. Null em qualquer outro status.';

create or replace function public.abandon_challenge_enrollment(
  target_enrollment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  enrollment_record record;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para abandonar o desafio.'
      using errcode = '42501';
  end if;

  select id, challenge_id, status
  into enrollment_record
  from public.challenge_enrollments
  where id = target_enrollment_id
    and user_id = actor_id
  for update;

  if enrollment_record.id is null then
    raise exception 'Inscricao nao encontrada.'
      using errcode = 'P0002';
  end if;

  if enrollment_record.status = 'abandoned'::public.enrollment_status then
    -- Idempotente: ja abandonado, nao ha nada novo a fazer. Ainda assim
    -- tenta registrar o evento (on conflict do nothing garante que nunca
    -- duplica), caso a primeira chamada tenha abandonado o status mas
    -- falhado antes de registrar o analytics por algum motivo externo.
    perform public.record_analytics_event(
      'challenge_abandoned', enrollment_record.challenge_id, enrollment_record.id,
      '{}'::jsonb, null, 'server'
    );

    return jsonb_build_object(
      'enrollment_id', enrollment_record.id,
      'status', 'abandoned',
      'already_abandoned', true
    );
  end if;

  if enrollment_record.status not in ('active', 'paused') then
    raise exception 'Esta inscricao nao pode ser abandonada neste status.'
      using errcode = '22023';
  end if;

  update public.challenge_enrollments
  set status = 'abandoned',
      abandoned_at = now()
  where id = enrollment_record.id;

  perform public.record_analytics_event(
    'challenge_abandoned', enrollment_record.challenge_id, enrollment_record.id,
    '{}'::jsonb, null, 'server'
  );

  return jsonb_build_object(
    'enrollment_id', enrollment_record.id,
    'status', 'abandoned',
    'already_abandoned', false
  );
end;
$$;

comment on function public.abandon_challenge_enrollment(uuid) is
  'Abandona uma inscricao propria (active/paused -> abandoned). Preserva '
  'todo o historico (daily_logs, habit_logs, diario, pontos, streak, '
  'conquistas, share_cards, analytics) - nunca apaga nada. Idempotente: '
  'chamar de novo depois de ja abandonado apenas confirma o estado, sem '
  'duplicar o evento challenge_abandoned.';

revoke all on function public.abandon_challenge_enrollment(uuid) from public, anon;
grant execute on function public.abandon_challenge_enrollment(uuid) to authenticated;

-- join_specific_challenge: mesmo corpo de 0017, com uma unica adicao - o
-- bloqueio de reinscricao apos abandono (novo errcode P0006).
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
  previously_abandoned boolean;
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

  select exists (
    select 1
    from public.challenge_enrollments ce
    where ce.user_id = actor_id
      and ce.challenge_id = target_challenge_id
      and ce.status = 'abandoned'
  ) into previously_abandoned;

  if previously_abandoned then
    raise exception 'Voce abandonou este desafio e nao pode se inscrever novamente.'
      using errcode = 'P0006';
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
    user_id, challenge_id, personal_start_date
  )
  values (
    actor_id, target_challenge_id, local_date
  )
  on conflict do nothing
  returning id into created_enrollment_id;

  if created_enrollment_id is not null then
    perform public.record_analytics_event(
      'challenge_joined', target_challenge_id, created_enrollment_id,
      jsonb_build_object('via', 'join_specific_challenge'), null, 'server'
    );
    return created_enrollment_id;
  end if;

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

comment on function public.join_specific_challenge(uuid) is
  'Inscreve o usuario autenticado num desafio especifico. Idempotente para '
  'quem ja esta active/paused. Recusa com errcode P0006 se o usuario ja '
  'abandonou este mesmo desafio antes - regra conservadora desta fase: sem '
  'reinscricao apos abandono.';

-- join_available_challenge: mesmo corpo de 0017, excluindo desafios que o
-- usuario ja abandonou do conjunto de candidatos.
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
        and ce.status in ('active', 'paused', 'abandoned')
    )
  order by c.start_date asc nulls last, c.created_at asc, c.id asc
  limit 1;

  if available_challenge_id is null then
    raise exception 'Nenhum ciclo ativo disponivel agora.'
      using errcode = 'P0002';
  end if;

  insert into public.challenge_enrollments (
    user_id, challenge_id, personal_start_date
  )
  values (
    actor_id, available_challenge_id, local_date
  )
  on conflict do nothing
  returning id into created_enrollment_id;

  if created_enrollment_id is not null then
    perform public.record_analytics_event(
      'challenge_joined', available_challenge_id, created_enrollment_id,
      jsonb_build_object('via', 'join_available_challenge'), null, 'server'
    );
    return created_enrollment_id;
  end if;

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

comment on function public.join_available_challenge() is
  'Inscreve o usuario autenticado no proximo desafio elegivel disponivel. '
  'Nunca oferece automaticamente um desafio que o usuario ja abandonou '
  '(status abandoned tambem entra no not exists de candidatos).';

-- admin_challenge_funnel (0017) ja contava challenge_abandoned desde que foi
-- criada, apenas documentando que o estagio ficaria zerado ate essa
-- transicao existir. Ela existe agora (abandon_challenge_enrollment acima)
-- - nenhuma mudanca de corpo e necessaria na funcao, so a nota do comentario
-- que ficou desatualizada.
comment on function public.admin_challenge_funnel(uuid) is
  'Funil de comportamento por desafio, lido de public.analytics_events. '
  'challenge_abandoned e registrado por abandon_challenge_enrollment() '
  '(0021) sempre que uma inscricao active/paused e abandonada.';
