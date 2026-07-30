-- Fase 6 (parte 3/4): instrumenta os marcos de funil que so podem ser
-- capturados NO MOMENTO em que acontecem, dentro das proprias RPCs de
-- jornada (join_available_challenge, join_specific_challenge,
-- update_habit_log, finalize_daily_log). Eventos de navegacao pura
-- (catalogo/detalhe visualizados, clique em participar, compartilhamento de
-- conquista) sao emitidos diretamente pelo codigo da aplicacao via
-- record_analytics_event() (0015) e nao precisam de alteracao nestas RPCs.
--
-- Cada funcao abaixo e reproduzida INTEGRALMENTE a partir da sua ultima
-- definicao aplicada (join_available_challenge: 0013; join_specific_challenge:
-- 0010; update_habit_log e finalize_daily_log: 0002/0005) - nao editamos os
-- arquivos ja aplicados, apenas redefinimos de novo (mesmo padrao ja usado
-- em 0013 para corrigir join_available_challenge). NENHUMA regra de negocio
-- existente muda aqui: pontuacao, streak, elegibilidade, RLS e mensagens de
-- erro permanecem identicas. As unicas adicoes sao chamadas a
-- record_analytics_event(), sempre via `perform` (o valor de retorno da
-- funcao de evento e descartado) e sempre DEPOIS que a operacao principal
-- teve sucesso - se o registro do evento falhar por qualquer motivo, isso
-- nunca deve impedir a jornada do usuario. Como record_analytics_event() so
-- lanca excecao para entradas realmente invalidas (nome de evento fora da
-- lista, metadata malformada) - nunca para "evento duplicado" (esse caso e
-- silenciosamente absorvido pelo indice unico parcial via
-- on conflict ... do nothing) - nenhum wrapping extra de exception e
-- necessario aqui.

-- join_available_challenge(): identico a 0013, com um evento
-- 'challenge_joined' apenas quando uma inscricao NOVA e criada (nunca no
-- caminho idempotente de "corrida rara" que devolve uma inscricao ja
-- existente).
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
    perform public.record_analytics_event(
      'challenge_joined',
      available_challenge_id,
      created_enrollment_id,
      jsonb_build_object('via', 'join_available_challenge'),
      null,
      'server'
    );

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

-- join_specific_challenge(): identico a 0010, com o mesmo evento
-- 'challenge_joined' apenas na criacao de uma inscricao nova.
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
    perform public.record_analytics_event(
      'challenge_joined',
      target_challenge_id,
      created_enrollment_id,
      jsonb_build_object('via', 'join_specific_challenge'),
      null,
      'server'
    );

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

-- update_habit_log(): identico a 0002, com um evento
-- 'challenge_first_habit_completed' quando esta e a PRIMEIRA conclusao de
-- habito da inscricao (idempotente via indice unico parcial em
-- record_analytics_event - so dispara de fato uma vez por inscricao).
-- Unica mudanca estrutural: dl.enrollment_id passa a ser selecionado (nao
-- era lido antes) para permitir a contagem por inscricao.
create or replace function public.update_habit_log(
  target_daily_log_id uuid,
  target_habit_id uuid,
  target_status public.habit_log_status,
  target_value_json jsonb default '{}'::jsonb,
  target_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  daily_record record;
  habit_record record;
  normalized_value jsonb := coalesce(target_value_json, '{}'::jsonb);
  normalized_note text := nullif(left(coalesce(target_note, ''), 1200), '');
  saved_habit_log_id uuid;
  progress jsonb;
  completed_habits_lifetime integer := 0;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para atualizar habito.'
      using errcode = '42501';
  end if;

  select
    dl.id,
    dl.enrollment_id,
    dl.challenge_id,
    dl.challenge_day_id,
    dl.status,
    dl.finalized_at,
    ce.status as enrollment_status,
    ce.user_id
  into daily_record
  from public.daily_logs dl
  join public.challenge_enrollments ce on ce.id = dl.enrollment_id
  where dl.id = target_daily_log_id
    and ce.user_id = actor_id
  limit 1
  for update of dl;

  if daily_record.id is null then
    raise exception 'Registro diario nao encontrado.'
      using errcode = '42501';
  end if;

  if daily_record.status = 'finalized' then
    raise exception 'O dia ja foi finalizado.'
      using errcode = '22023';
  end if;

  if daily_record.enrollment_status <> 'active'::public.enrollment_status then
    raise exception 'A inscricao nao esta ativa para editar habitos.'
      using errcode = '22023';
  end if;

  if char_length(coalesce(target_note, '')) > 1200 then
    raise exception 'A nota do habito excede o limite permitido.'
      using errcode = '22023';
  end if;

  select
    h.id,
    h.challenge_id,
    h.habit_type,
    h.active,
    cdh.required
  into habit_record
  from public.habits h
  join public.challenge_day_habits cdh
    on cdh.habit_id = h.id
    and cdh.challenge_day_id = daily_record.challenge_day_id
  where h.id = target_habit_id
    and h.challenge_id = daily_record.challenge_id
  limit 1;

  if habit_record.id is null or not habit_record.active then
    raise exception 'Habito indisponivel para este dia.'
      using errcode = '22023';
  end if;

  if habit_record.habit_type not in (
    'boolean'::public.habit_type,
    'duration'::public.habit_type,
    'quantity'::public.habit_type,
    'reading'::public.habit_type
  ) then
    raise exception 'Tipo de habito ainda nao suportado nesta jornada.'
      using errcode = '22023';
  end if;

  if target_status is null or target_status not in (
    'pending'::public.habit_log_status,
    'completed'::public.habit_log_status,
    'not_applicable'::public.habit_log_status,
    'skipped'::public.habit_log_status
  ) then
    raise exception 'Status de habito invalido.'
      using errcode = '22023';
  end if;

  if target_status = 'not_applicable'::public.habit_log_status
    and habit_record.required then
    raise exception 'Habito obrigatorio nao pode ser marcado como nao aplicavel.'
      using errcode = '22023';
  end if;

  if habit_record.habit_type in ('quantity', 'duration') then
    if normalized_value <> '{}'::jsonb
      and (
        jsonb_typeof(normalized_value) <> 'object'
        or jsonb_typeof(normalized_value -> 'value') <> 'number'
      ) then
      raise exception 'Valor numerico necessario para este habito.'
        using errcode = '22023';
    end if;

    if target_status = 'completed'::public.habit_log_status
      and normalized_value = '{}'::jsonb then
      raise exception 'Valor numerico necessario para concluir este habito.'
        using errcode = '22023';
    end if;

    if normalized_value <> '{}'::jsonb
      and (normalized_value ->> 'value')::numeric < 0 then
      raise exception 'Valor do habito nao pode ser negativo.'
        using errcode = '22023';
    end if;

    if normalized_value <> '{}'::jsonb then
      normalized_value := jsonb_build_object(
        'value',
        (normalized_value ->> 'value')::numeric
      );
    end if;

    if target_status in (
      'not_applicable'::public.habit_log_status,
      'skipped'::public.habit_log_status
    ) then
      normalized_value := '{}'::jsonb;
    end if;
  end if;

  if habit_record.habit_type in ('boolean', 'reading') then
    normalized_value := case
      when target_status = 'completed' then jsonb_build_object('completed', true)
      else '{}'::jsonb
    end;
  end if;

  insert into public.habit_logs (
    daily_log_id,
    challenge_day_id,
    habit_id,
    status,
    value_json,
    note,
    completed_at
  )
  values (
    daily_record.id,
    daily_record.challenge_day_id,
    habit_record.id,
    target_status,
    normalized_value,
    normalized_note,
    case when target_status = 'completed' then now() else null end
  )
  on conflict (daily_log_id, habit_id) do update
    set status = excluded.status,
        value_json = excluded.value_json,
        note = excluded.note,
        completed_at = excluded.completed_at
  returning id into saved_habit_log_id;

  progress := public.journey_recalculate_daily_log(daily_record.id);

  if target_status = 'completed'::public.habit_log_status then
    select count(*)
    into completed_habits_lifetime
    from public.habit_logs hl
    join public.daily_logs dl on dl.id = hl.daily_log_id
    where dl.enrollment_id = daily_record.enrollment_id
      and hl.status = 'completed';

    if completed_habits_lifetime = 1 then
      perform public.record_analytics_event(
        'challenge_first_habit_completed',
        daily_record.challenge_id,
        daily_record.enrollment_id,
        '{}'::jsonb,
        null,
        'server'
      );
    end if;
  end if;

  return progress || jsonb_build_object(
    'habit_log_id', saved_habit_log_id,
    'status', target_status
  );
end;
$$;

revoke execute on function public.update_habit_log(uuid, uuid, public.habit_log_status, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.update_habit_log(uuid, uuid, public.habit_log_status, jsonb, text)
  to authenticated;

-- finalize_daily_log(): identico a 0005 (ultima versao aplicada), com
-- quatro eventos novos, todos emitidos apenas no caminho de finalizacao
-- REAL (nunca no early-return de "ja finalizado"): 'challenge_day_completed'
-- (sempre, um por dia), 'challenge_day_7_reached'/'challenge_halfway_reached'
-- (quando o limiar e cruzado, idempotente por inscricao) e
-- 'challenge_completed' (quando completed_cycle e verdadeiro, idempotente
-- por inscricao). Nenhuma regra de pontuacao, streak ou conquista muda.
create or replace function public.finalize_daily_log(
  target_daily_log_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  daily_record record;
  progress jsonb;
  applicable_habits integer := 0;
  completed_habits integer := 0;
  completion_percent numeric(5, 2) := 0;
  reflection_points integer := 10;
  finalize_day_points integer := 10;
  all_habits_bonus_points integer := 30;
  streak_minimum_completion numeric(5, 2) := 70;
  journal_record public.journal_entries;
  journal_completed boolean := false;
  habit_record record;
  v_points_earned integer := 0;
  streak_count integer := 0;
  best_streak integer := 0;
  expected_date date;
  log_record record;
  finalized_days integer := 0;
  completed_habits_lifetime integer := 0;
  reading_completions integer := 0;
  physical_activity_completions integer := 0;
  reflection_days integer := 0;
  completed_cycle boolean := false;
  return_strong boolean := false;
  unlocked_achievements jsonb := '[]'::jsonb;
  achievement_record record;
  missing_required_habits integer := 0;
  halfway_target integer := 0;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para finalizar o dia.'
      using errcode = '42501';
  end if;

  select
    dl.id,
    dl.enrollment_id,
    dl.challenge_id,
    dl.challenge_day_id,
    dl.log_date,
    dl.status,
    dl.completion_percent,
    dl.finalized_at,
    ce.user_id,
    ce.status as enrollment_status,
    ce.streak_current,
    ce.streak_best,
    ce.current_day,
    c.duration_days,
    c.rules_config,
    c.status as challenge_status,
    c.deleted_at as challenge_deleted_at
  into daily_record
  from public.daily_logs dl
  join public.challenge_enrollments ce on ce.id = dl.enrollment_id
  join public.challenges c on c.id = dl.challenge_id
  where dl.id = target_daily_log_id
    and ce.user_id = actor_id
  limit 1
  for update of dl, ce;

  if daily_record.id is null then
    raise exception 'Registro diario nao encontrado.'
      using errcode = '42501';
  end if;

  if daily_record.status = 'finalized' then
    select coalesce(sum(points), 0)
    into v_points_earned
    from public.point_events
    where daily_log_id = daily_record.id;

    return jsonb_build_object(
      'daily_log_id', daily_record.id,
      'status', 'finalized',
      'already_finalized', true,
      'completion_percent', daily_record.completion_percent,
      'points_earned', v_points_earned,
      'unlocked_achievements', unlocked_achievements
    );
  end if;

  if daily_record.enrollment_status <> 'active'::public.enrollment_status then
    raise exception 'A inscricao nao esta ativa para finalizar o dia.'
      using errcode = '22023';
  end if;

  if daily_record.challenge_status <> 'active'::public.challenge_status
    or daily_record.challenge_deleted_at is not null then
    raise exception 'O ciclo nao esta ativo para finalizacao.'
      using errcode = '22023';
  end if;

  select count(*)
  into missing_required_habits
  from public.challenge_day_habits cdh
  left join public.habit_logs hl
    on hl.habit_id = cdh.habit_id
    and hl.daily_log_id = daily_record.id
  where cdh.challenge_day_id = daily_record.challenge_day_id
    and cdh.required
    and coalesce(hl.status, 'pending'::public.habit_log_status)
      <> 'completed'::public.habit_log_status;

  if missing_required_habits > 0 then
    raise exception 'Habitos obrigatorios pendentes. Conclua todos antes de finalizar o dia.'
      using errcode = 'P0003';
  end if;

  progress := public.journey_recalculate_daily_log(daily_record.id);
  applicable_habits := (progress ->> 'applicable_habits')::integer;
  completed_habits := (progress ->> 'completed_habits')::integer;
  completion_percent := (progress ->> 'completion_percent')::numeric(5, 2);

  reflection_points := public.journey_rule_int(
    daily_record.rules_config,
    'reflection_points',
    10
  );
  finalize_day_points := public.journey_rule_int(
    daily_record.rules_config,
    'finalize_day_points',
    10
  );
  all_habits_bonus_points := public.journey_rule_int(
    daily_record.rules_config,
    'all_habits_bonus_points',
    30
  );
  streak_minimum_completion := public.journey_rule_int(
    daily_record.rules_config,
    'streak_minimum_completion',
    70
  )::numeric(5, 2);

  select *
  into journal_record
  from public.journal_entries
  where daily_log_id = daily_record.id
  limit 1;

  if journal_record.id is not null then
    journal_completed := public.journey_has_journal_content(journal_record);
  end if;

  for habit_record in
    select
      h.id,
      coalesce(cdh.override_points, h.points) as points
    from public.challenge_day_habits cdh
    join public.habits h on h.id = cdh.habit_id
    join public.habit_logs hl
      on hl.habit_id = h.id
      and hl.daily_log_id = daily_record.id
    where cdh.challenge_day_id = daily_record.challenge_day_id
      and hl.status = 'completed'
  loop
    insert into public.point_events (
      user_id,
      enrollment_id,
      challenge_id,
      daily_log_id,
      source_type,
      source_id,
      points,
      idempotency_key,
      metadata
    )
    values (
      actor_id,
      daily_record.enrollment_id,
      daily_record.challenge_id,
      daily_record.id,
      'habit',
      habit_record.id,
      habit_record.points,
      daily_record.enrollment_id || ':' || daily_record.id || ':habit:' || habit_record.id,
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end loop;

  if journal_completed and reflection_points > 0 then
    insert into public.point_events (
      user_id,
      enrollment_id,
      challenge_id,
      daily_log_id,
      source_type,
      source_id,
      points,
      idempotency_key,
      metadata
    )
    values (
      actor_id,
      daily_record.enrollment_id,
      daily_record.challenge_id,
      daily_record.id,
      'reflection',
      journal_record.id,
      reflection_points,
      daily_record.enrollment_id || ':' || daily_record.id || ':reflection',
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if finalize_day_points > 0 then
    insert into public.point_events (
      user_id,
      enrollment_id,
      challenge_id,
      daily_log_id,
      source_type,
      source_id,
      points,
      idempotency_key,
      metadata
    )
    values (
      actor_id,
      daily_record.enrollment_id,
      daily_record.challenge_id,
      daily_record.id,
      'day_finalized',
      daily_record.id,
      finalize_day_points,
      daily_record.enrollment_id || ':' || daily_record.id || ':day-finalized',
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if applicable_habits > 0
    and completed_habits = applicable_habits
    and all_habits_bonus_points > 0 then
    insert into public.point_events (
      user_id,
      enrollment_id,
      challenge_id,
      daily_log_id,
      source_type,
      source_id,
      points,
      idempotency_key,
      metadata
    )
    values (
      actor_id,
      daily_record.enrollment_id,
      daily_record.challenge_id,
      daily_record.id,
      'all_habits_completed',
      daily_record.id,
      all_habits_bonus_points,
      daily_record.enrollment_id || ':' || daily_record.id || ':all-habits',
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  update public.daily_logs
  set status = 'finalized',
      finalized_at = now(),
      editable_until = now() + (
        public.journey_rule_int(rules_snapshot, 'journal_edit_minutes_after_finalize', 0)
        || ' minutes'
      )::interval
  where id = daily_record.id;

  select coalesce(sum(points), 0)
  into v_points_earned
  from public.point_events
  where daily_log_id = daily_record.id;

  update public.daily_logs
  set points_earned = v_points_earned
  where id = daily_record.id;

  expected_date := daily_record.log_date;

  for log_record in
    select dl.log_date, dl.completion_percent
    from public.daily_logs dl
    where dl.enrollment_id = daily_record.enrollment_id
      and dl.status = 'finalized'
      and dl.log_date <= daily_record.log_date
    order by dl.log_date desc
  loop
    if log_record.log_date <> expected_date then
      exit;
    end if;

    if log_record.completion_percent < streak_minimum_completion then
      exit;
    end if;

    streak_count := streak_count + 1;
    expected_date := expected_date - 1;
  end loop;

  best_streak := greatest(daily_record.streak_best, streak_count);

  select count(*)
  into finalized_days
  from public.daily_logs
  where enrollment_id = daily_record.enrollment_id
    and status = 'finalized';

  completed_cycle := finalized_days >= daily_record.duration_days;
  return_strong := completion_percent >= streak_minimum_completion
    and exists (
      select 1
      from public.daily_logs previous_dl
      where previous_dl.enrollment_id = daily_record.enrollment_id
        and previous_dl.status = 'finalized'
        and previous_dl.log_date < daily_record.log_date
    )
    and not exists (
      select 1
      from public.daily_logs previous_valid_dl
      where previous_valid_dl.enrollment_id = daily_record.enrollment_id
        and previous_valid_dl.status = 'finalized'
        and previous_valid_dl.log_date = daily_record.log_date - 1
        and previous_valid_dl.completion_percent >= streak_minimum_completion
    );

  update public.challenge_enrollments
  set points_total = (
        select coalesce(sum(points), 0)
        from public.point_events pe
        where pe.enrollment_id = daily_record.enrollment_id
      ),
      streak_current = streak_count,
      streak_best = best_streak,
      completion_percent = least(
        100,
        round((finalized_days::numeric / daily_record.duration_days::numeric) * 100, 2)
      ),
      status = case
        when completed_cycle then 'completed'::public.enrollment_status
        else status
      end,
      completed_at = case
        when completed_cycle then coalesce(completed_at, now())
        else completed_at
      end
  where id = daily_record.enrollment_id;

  select count(*)
  into completed_habits_lifetime
  from public.habit_logs hl
  join public.daily_logs dl on dl.id = hl.daily_log_id
  where dl.enrollment_id = daily_record.enrollment_id
    and hl.status = 'completed';

  select count(*)
  into reading_completions
  from public.habit_logs hl
  join public.daily_logs dl on dl.id = hl.daily_log_id
  join public.habits h on h.id = hl.habit_id
  where dl.enrollment_id = daily_record.enrollment_id
    and hl.status = 'completed'
    and h.habit_type = 'reading';

  select count(*)
  into physical_activity_completions
  from public.habit_logs hl
  join public.daily_logs dl on dl.id = hl.daily_log_id
  join public.habits h on h.id = hl.habit_id
  where dl.enrollment_id = daily_record.enrollment_id
    and hl.status = 'completed'
    and (
      lower(coalesce(h.category, '')) in ('corpo', 'atividade fisica', 'atividade física', 'fisico', 'físico')
      or lower(coalesce(h.icon, '')) in ('activity', 'dumbbell', 'run', 'footprints')
    );

  select count(*)
  into reflection_days
  from public.journal_entries je
  join public.daily_logs dl on dl.id = je.daily_log_id
  where dl.enrollment_id = daily_record.enrollment_id
    and public.journey_has_journal_content(je);

  for achievement_record in
    select *
    from public.achievements a
    where a.challenge_id = daily_record.challenge_id
      and a.active
      and a.slug in (
        'primeiro-habito',
        'primeiro-dia',
        'tres-dias-seguidos',
        'primeira-semana',
        'sete-leituras',
        'sete-atividades-fisicas',
        'sete-reflexoes',
        'metade-do-caminho',
        'retorno-forte',
        'missao-concluida'
      )
  loop
    if (
      (achievement_record.slug = 'primeiro-habito' and completed_habits_lifetime >= 1)
      or (achievement_record.slug = 'primeiro-dia' and finalized_days >= 1)
      or (achievement_record.slug = 'tres-dias-seguidos' and streak_count >= 3)
      or (achievement_record.slug = 'primeira-semana' and finalized_days >= 7)
      or (achievement_record.slug = 'sete-leituras' and reading_completions >= 7)
      or (achievement_record.slug = 'sete-atividades-fisicas' and physical_activity_completions >= 7)
      or (achievement_record.slug = 'sete-reflexoes' and reflection_days >= 7)
      or (
        achievement_record.slug = 'metade-do-caminho'
        and finalized_days >= ceil(daily_record.duration_days::numeric / 2)
      )
      or (achievement_record.slug = 'retorno-forte' and return_strong)
      or (achievement_record.slug = 'missao-concluida' and completed_cycle)
    ) then
      insert into public.user_achievements (
        user_id,
        enrollment_id,
        challenge_id,
        achievement_id,
        metadata
      )
      values (
        actor_id,
        daily_record.enrollment_id,
        daily_record.challenge_id,
        achievement_record.id,
        jsonb_build_object(
          'daily_log_id', daily_record.id,
          'day_number', daily_record.current_day,
          'completion_percent', completion_percent
        )
      )
      on conflict (user_id, enrollment_id, achievement_id) do nothing;

      if found then
        unlocked_achievements := unlocked_achievements || jsonb_build_array(
          jsonb_build_object(
            'id', achievement_record.id,
            'name', achievement_record.name,
            'slug', achievement_record.slug,
            'icon', achievement_record.icon,
            'points_bonus', achievement_record.points_bonus
          )
        );

        if achievement_record.points_bonus > 0 then
          insert into public.point_events (
            user_id,
            enrollment_id,
            challenge_id,
            daily_log_id,
            source_type,
            source_id,
            points,
            idempotency_key,
            metadata
          )
          values (
            actor_id,
            daily_record.enrollment_id,
            daily_record.challenge_id,
            daily_record.id,
            'achievement',
            achievement_record.id,
            achievement_record.points_bonus,
            daily_record.enrollment_id || ':achievement:' || achievement_record.id,
            jsonb_build_object('daily_log_id', daily_record.id)
          )
          on conflict (idempotency_key) do nothing;
        end if;
      end if;
    end if;
  end loop;

  select coalesce(sum(points), 0)
  into v_points_earned
  from public.point_events
  where daily_log_id = daily_record.id;

  update public.daily_logs
  set points_earned = v_points_earned
  where id = daily_record.id;

  update public.challenge_enrollments
  set points_total = (
    select coalesce(sum(points), 0)
    from public.point_events pe
    where pe.enrollment_id = daily_record.enrollment_id
  )
  where id = daily_record.enrollment_id;

  perform public.record_analytics_event(
    'challenge_day_completed',
    daily_record.challenge_id,
    daily_record.enrollment_id,
    jsonb_build_object('day_number', daily_record.current_day, 'completion_percent', completion_percent),
    null,
    'server'
  );

  if finalized_days >= 7 then
    perform public.record_analytics_event(
      'challenge_day_7_reached',
      daily_record.challenge_id,
      daily_record.enrollment_id,
      '{}'::jsonb,
      null,
      'server'
    );
  end if;

  halfway_target := ceil(daily_record.duration_days::numeric / 2);

  if finalized_days >= halfway_target then
    perform public.record_analytics_event(
      'challenge_halfway_reached',
      daily_record.challenge_id,
      daily_record.enrollment_id,
      '{}'::jsonb,
      null,
      'server'
    );
  end if;

  if completed_cycle then
    perform public.record_analytics_event(
      'challenge_completed',
      daily_record.challenge_id,
      daily_record.enrollment_id,
      '{}'::jsonb,
      null,
      'server'
    );
  end if;

  return jsonb_build_object(
    'daily_log_id', daily_record.id,
    'status', 'finalized',
    'already_finalized', false,
    'applicable_habits', applicable_habits,
    'completed_habits', completed_habits,
    'completion_percent', completion_percent,
    'points_earned', v_points_earned,
    'streak_current', streak_count,
    'streak_best', best_streak,
    'unlocked_achievements', unlocked_achievements
  );
end;
$$;

-- Grants on public.finalize_daily_log(uuid) are unchanged: CREATE OR REPLACE
-- FUNCTION preserves existing privileges (already granted to `authenticated`
-- in 0002_daily_journey_core.sql), so no revoke/grant is repeated here.
