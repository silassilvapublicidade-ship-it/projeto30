-- Fixes a second, previously hidden bug in finalize_daily_log(), only
-- reachable after 0004_fix_finalize_daily_log.sql let the function get
-- past its first crash. The streak-lookback loop selected the bare column
-- `completion_percent` from public.daily_logs while the function also has
-- a local variable named `completion_percent` in scope; with the default
-- plpgsql.variable_conflict = error, Postgres raises "column reference
-- completion_percent is ambiguous". Fix: alias the table and qualify every
-- column in that query (dl.log_date, dl.status, dl.completion_percent)
-- instead of renaming the long-lived completion_percent variable, which is
-- read in several other places in this function.

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
