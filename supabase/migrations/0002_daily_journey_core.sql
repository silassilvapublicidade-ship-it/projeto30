create or replace function public.journey_get_local_date(target_timezone text)
returns date
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  safe_timezone text := coalesce(nullif(target_timezone, ''), 'America/Sao_Paulo');
begin
  perform 1
  from pg_timezone_names
  where name = safe_timezone;

  if not found then
    safe_timezone := 'America/Sao_Paulo';
  end if;

  return timezone(safe_timezone, now())::date;
end;
$$;

create or replace function public.journey_calculate_day(
  target_start_date date,
  target_local_date date
)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select (target_local_date - target_start_date) + 1;
$$;

create or replace function public.journey_rule_int(
  target_rules jsonb,
  target_key text,
  fallback_value integer
)
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  raw_value text;
begin
  raw_value := target_rules ->> target_key;

  if raw_value is null or raw_value !~ '^\d+$' then
    return fallback_value;
  end if;

  return greatest(0, raw_value::integer);
end;
$$;

create or replace function public.journey_has_journal_content(
  target_journal public.journal_entries
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(nullif(trim(target_journal.content), ''), '') <> ''
    or coalesce(nullif(trim(target_journal.gratitude), ''), '') <> ''
    or coalesce(nullif(trim(target_journal.difficulty), ''), '') <> ''
    or coalesce(nullif(trim(target_journal.victory), ''), '') <> ''
    or coalesce(nullif(trim(target_journal.tomorrow_focus), ''), '') <> ''
    or coalesce(nullif(trim(target_journal.mood), ''), '') <> '';
$$;

create or replace function public.journey_recalculate_daily_log(
  target_daily_log_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  applicable_habits integer := 0;
  completed_habits integer := 0;
  completion_percent numeric(5, 2) := 0;
begin
  select
    count(*) filter (where coalesce(hl.status, 'pending'::public.habit_log_status) <> 'not_applicable'),
    count(*) filter (where hl.status = 'completed')
  into applicable_habits, completed_habits
  from public.daily_logs dl
  join public.challenge_day_habits cdh on cdh.challenge_day_id = dl.challenge_day_id
  left join public.habit_logs hl
    on hl.daily_log_id = dl.id
    and hl.habit_id = cdh.habit_id
  where dl.id = target_daily_log_id;

  completion_percent := case
    when applicable_habits = 0 then 100
    else round((completed_habits::numeric / applicable_habits::numeric) * 100, 2)
  end;

  update public.daily_logs
  set completion_percent = journey_recalculate_daily_log.completion_percent
  where id = target_daily_log_id;

  return jsonb_build_object(
    'applicable_habits', applicable_habits,
    'completed_habits', completed_habits,
    'completion_percent', completion_percent
  );
end;
$$;

create unique index if not exists challenge_enrollments_one_active_per_user
  on public.challenge_enrollments (user_id)
  where status in ('active', 'paused');

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

  select id
  into existing_enrollment_id
  from public.challenge_enrollments
  where user_id = actor_id
    and status in ('active', 'paused')
  order by joined_at desc
  limit 1;

  if existing_enrollment_id is not null then
    return existing_enrollment_id;
  end if;

  select id
  into available_challenge_id
  from public.challenges
  where status = 'active'
    and deleted_at is null
    and (enrollment_start is null or enrollment_start <= local_date)
    and (enrollment_end is null or enrollment_end >= local_date)
  order by created_at asc
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

  select id
  into existing_enrollment_id
  from public.challenge_enrollments
  where user_id = actor_id
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

create or replace function public.ensure_today_daily_log(
  target_enrollment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  enrollment_record record;
  local_date date;
  calculated_day integer;
  selected_challenge_day_id uuid;
  daily_log_id uuid;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para abrir o dia.'
      using errcode = '42501';
  end if;

  select
    ce.id,
    ce.challenge_id,
    ce.personal_start_date,
    ce.status,
    c.duration_days,
    c.rules_config,
    c.status as challenge_status,
    u.timezone
  into enrollment_record
  from public.challenge_enrollments ce
  join public.challenges c on c.id = ce.challenge_id
  join public.users u on u.id = ce.user_id
  where ce.user_id = actor_id
    and ce.status = 'active'
    and c.status = 'active'
    and c.deleted_at is null
    and (target_enrollment_id is null or ce.id = target_enrollment_id)
  order by ce.joined_at desc
  limit 1
  for update of ce;

  if enrollment_record.id is null then
    raise exception 'Nenhuma inscricao ativa encontrada.'
      using errcode = 'P0002';
  end if;

  local_date := public.journey_get_local_date(enrollment_record.timezone);
  calculated_day := public.journey_calculate_day(
    enrollment_record.personal_start_date,
    local_date
  );

  if calculated_day < 1 then
    raise exception 'O ciclo ainda nao iniciou para este usuario.'
      using errcode = '22023';
  end if;

  if calculated_day > enrollment_record.duration_days then
    raise exception 'O ciclo ja passou da duracao configurada.'
      using errcode = '22023';
  end if;

  select id
  into selected_challenge_day_id
  from public.challenge_days
  where challenge_id = enrollment_record.challenge_id
    and day_number = calculated_day
  limit 1;

  if selected_challenge_day_id is null then
    raise exception 'Dia do ciclo nao configurado.'
      using errcode = 'P0002';
  end if;

  insert into public.daily_logs (
    enrollment_id,
    challenge_id,
    challenge_day_id,
    log_date,
    rules_snapshot
  )
  values (
    enrollment_record.id,
    enrollment_record.challenge_id,
    selected_challenge_day_id,
    local_date,
    enrollment_record.rules_config
  )
  on conflict do nothing
  returning id into daily_log_id;

  if daily_log_id is null then
    select id
    into daily_log_id
    from public.daily_logs existing_dl
    where existing_dl.enrollment_id = enrollment_record.id
      and existing_dl.challenge_day_id = selected_challenge_day_id
    limit 1;
  end if;

  if daily_log_id is null then
    select id
    into daily_log_id
    from public.daily_logs
    where enrollment_id = enrollment_record.id
      and log_date = local_date
    limit 1;
  end if;

  if daily_log_id is null then
    raise exception 'Nao foi possivel abrir o registro diario.'
      using errcode = '23505';
  end if;

  update public.challenge_enrollments
  set current_day = calculated_day
  where id = enrollment_record.id;

  perform public.journey_recalculate_daily_log(daily_log_id);

  return daily_log_id;
end;
$$;

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
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para atualizar habito.'
      using errcode = '42501';
  end if;

  select
    dl.id,
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

  return progress || jsonb_build_object(
    'habit_log_id', saved_habit_log_id,
    'status', target_status
  );
end;
$$;

create or replace function public.save_journal_entry(
  target_daily_log_id uuid,
  target_content text default null,
  target_gratitude text default null,
  target_difficulty text default null,
  target_victory text default null,
  target_tomorrow_focus text default null,
  target_mood text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  daily_record record;
  saved_journal_id uuid;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para salvar reflexao.'
      using errcode = '42501';
  end if;

  select
    dl.id,
    dl.enrollment_id,
    dl.status,
    dl.editable_until,
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

  if daily_record.status = 'finalized'
    and (daily_record.editable_until is null or now() > daily_record.editable_until) then
    raise exception 'A reflexao deste dia nao pode mais ser alterada.'
      using errcode = '22023';
  end if;

  if daily_record.status <> 'finalized'::public.daily_log_status
    and daily_record.enrollment_status <> 'active'::public.enrollment_status then
    raise exception 'A inscricao nao esta ativa para salvar reflexao.'
      using errcode = '22023';
  end if;

  if char_length(coalesce(target_content, '')) > 2800
    or char_length(coalesce(target_gratitude, '')) > 1200
    or char_length(coalesce(target_difficulty, '')) > 1200
    or char_length(coalesce(target_victory, '')) > 1200
    or char_length(coalesce(target_tomorrow_focus, '')) > 1200
    or char_length(coalesce(target_mood, '')) > 80 then
    raise exception 'A reflexao excede o limite permitido.'
      using errcode = '22023';
  end if;

  insert into public.journal_entries (
    daily_log_id,
    enrollment_id,
    user_id,
    content,
    gratitude,
    difficulty,
    victory,
    tomorrow_focus,
    mood
  )
  values (
    daily_record.id,
    daily_record.enrollment_id,
    actor_id,
    nullif(coalesce(target_content, ''), ''),
    nullif(coalesce(target_gratitude, ''), ''),
    nullif(coalesce(target_difficulty, ''), ''),
    nullif(coalesce(target_victory, ''), ''),
    nullif(coalesce(target_tomorrow_focus, ''), ''),
    nullif(coalesce(target_mood, ''), '')
  )
  on conflict (daily_log_id) do update
    set content = excluded.content,
        gratitude = excluded.gratitude,
        difficulty = excluded.difficulty,
        victory = excluded.victory,
        tomorrow_focus = excluded.tomorrow_focus,
        mood = excluded.mood
  returning id into saved_journal_id;

  return saved_journal_id;
end;
$$;

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
  points_earned integer := 0;
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
    into points_earned
    from public.point_events
    where daily_log_id = daily_record.id;

    return jsonb_build_object(
      'daily_log_id', daily_record.id,
      'status', 'finalized',
      'already_finalized', true,
      'completion_percent', daily_record.completion_percent,
      'points_earned', points_earned,
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
  into points_earned
  from public.point_events
  where daily_log_id = daily_record.id;

  update public.daily_logs
  set points_earned = finalize_daily_log.points_earned
  where id = daily_record.id;

  expected_date := daily_record.log_date;

  for log_record in
    select log_date, completion_percent
    from public.daily_logs
    where enrollment_id = daily_record.enrollment_id
      and status = 'finalized'
      and log_date <= daily_record.log_date
    order by log_date desc
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
  into points_earned
  from public.point_events
  where daily_log_id = daily_record.id;

  update public.daily_logs
  set points_earned = finalize_daily_log.points_earned
  where id = daily_record.id;

  update public.challenge_enrollments
  set points_total = (
    select coalesce(sum(points), 0)
    from public.point_events pe
    where pe.enrollment_id = daily_record.enrollment_id
  )
  where id = daily_record.enrollment_id;

  return jsonb_build_object(
    'daily_log_id', daily_record.id,
    'status', 'finalized',
    'already_finalized', false,
    'applicable_habits', applicable_habits,
    'completed_habits', completed_habits,
    'completion_percent', completion_percent,
    'points_earned', points_earned,
    'streak_current', streak_count,
    'streak_best', best_streak,
    'unlocked_achievements', unlocked_achievements
  );
end;
$$;

insert into public.achievements (
  challenge_id,
  name,
  slug,
  description,
  icon,
  points_bonus,
  rule_config,
  sort_order
)
select
  c.id,
  item.name,
  item.slug,
  item.description,
  item.icon,
  item.points_bonus,
  item.rule_config,
  item.sort_order
from public.challenges c
cross join (
  values
    ('Primeiro habito', 'primeiro-habito', 'Concluir o primeiro habito do ciclo.', 'sparkles', 0, '{"type": "first_habit"}'::jsonb, 11),
    ('Primeiro dia', 'primeiro-dia', 'Finalizar o primeiro dia do ciclo.', 'sunrise', 0, '{"type": "first_day"}'::jsonb, 12),
    ('Tres dias seguidos', 'tres-dias-seguidos', 'Manter tres dias validos em sequencia.', 'flame', 0, '{"type": "streak", "days": 3}'::jsonb, 13),
    ('Primeira semana', 'primeira-semana', 'Finalizar sete dias do ciclo.', 'calendar-check', 0, '{"type": "finalized_days", "days": 7}'::jsonb, 14),
    ('Sete leituras', 'sete-leituras', 'Concluir sete leituras no ciclo.', 'book-open', 0, '{"type": "reading_completions", "count": 7}'::jsonb, 15),
    ('Sete atividades fisicas', 'sete-atividades-fisicas', 'Concluir sete atividades fisicas.', 'activity', 0, '{"type": "physical_activity_completions", "count": 7}'::jsonb, 16),
    ('Sete reflexoes', 'sete-reflexoes', 'Registrar sete reflexoes.', 'pen-line', 0, '{"type": "reflection_days", "count": 7}'::jsonb, 17),
    ('Metade do caminho', 'metade-do-caminho', 'Finalizar metade da duracao configurada.', 'route', 0, '{"type": "halfway"}'::jsonb, 18),
    ('Retorno forte', 'retorno-forte', 'Voltar com um dia valido depois de perder o ritmo.', 'rotate-ccw', 0, '{"type": "return_after_break"}'::jsonb, 19),
    ('Missao concluida', 'missao-concluida', 'Finalizar a duracao configurada do ciclo.', 'trophy', 0, '{"type": "challenge_completed"}'::jsonb, 20)
) as item(name, slug, description, icon, points_bonus, rule_config, sort_order)
where c.status in ('active', 'paused', 'ended')
on conflict (challenge_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  points_bonus = excluded.points_bonus,
  rule_config = excluded.rule_config,
  sort_order = excluded.sort_order,
  updated_at = now();

update public.achievements old_achievement
set active = false,
    updated_at = now()
where old_achievement.slug in ('primeiro-passo', 'tres-dias-de-constancia')
  and exists (
    select 1
    from public.achievements canonical_achievement
    where canonical_achievement.challenge_id = old_achievement.challenge_id
      and canonical_achievement.slug = case
        when old_achievement.slug = 'primeiro-passo' then 'primeiro-habito'
        else 'tres-dias-seguidos'
      end
  );

revoke execute on function public.journey_get_local_date(text)
  from public, anon, authenticated;
revoke execute on function public.journey_calculate_day(date, date)
  from public, anon, authenticated;
revoke execute on function public.journey_rule_int(jsonb, text, integer)
  from public, anon, authenticated;
revoke execute on function public.journey_has_journal_content(public.journal_entries)
  from public, anon, authenticated;
revoke execute on function public.journey_recalculate_daily_log(uuid)
  from public, anon, authenticated;
revoke execute on function public.join_available_challenge()
  from public, anon, authenticated;
revoke execute on function public.ensure_today_daily_log(uuid)
  from public, anon, authenticated;
revoke execute on function public.update_habit_log(
  uuid,
  uuid,
  public.habit_log_status,
  jsonb,
  text
) from public, anon, authenticated;
revoke execute on function public.save_journal_entry(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;
revoke execute on function public.finalize_daily_log(uuid)
  from public, anon, authenticated;

grant execute on function public.join_available_challenge()
  to authenticated;
grant execute on function public.ensure_today_daily_log(uuid)
  to authenticated;
grant execute on function public.update_habit_log(
  uuid,
  uuid,
  public.habit_log_status,
  jsonb,
  text
) to authenticated;
grant execute on function public.save_journal_entry(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
grant execute on function public.finalize_daily_log(uuid)
  to authenticated;
