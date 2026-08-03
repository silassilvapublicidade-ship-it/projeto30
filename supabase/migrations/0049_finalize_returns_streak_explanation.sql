-- Rodada "experiencia diaria" - Parte A: auditoria do streak.
--
-- CAUSA RAIZ REAL (investigada com dados de producao da conta do Silas, sem
-- alterar nada): NAO HA bug de calculo. streak_current chegou a 0 porque o
-- Dia 2 teve completion_percent = 50.00 (5 de 10 habitos frequency_type =
-- 'daily' concluidos - os itens weekly/monthly daquele dia, corretamente
-- excluidos do denominador diario, nao contam aqui por desenho), abaixo do
-- streak_minimum_completion do ciclo (70, o default de journey_rule_int
-- quando rules_config nao define um valor proprio). O loop que conta dias
-- consecutivos (mais abaixo, inalterado nesta migration) para exatamente na
-- primeira iteracao porque o proprio Dia 2 ja fica abaixo do minimo -
-- exatamente o comportamento correto e documentado da regra existente. O
-- streak_best permanece 1 (o maior valor ja visto), o que e coerente.
--
-- O problema real e de COMUNICACAO, nao de calculo: a RPC nunca devolvia
-- streak_minimum_completion nem indicava se o dia atingiu o minimo, entao a
-- UI so podia mostrar "0 dias" sem nenhuma explicacao. Esta migration so
-- ACRESCENTA esses dois campos ao retorno json (streak_minimum_completion,
-- streak_met_minimum) - nenhuma regra de pontos, frequencia, conclusao,
-- historico, analytics, conquista, inscricao ou pausa muda. A formula do
-- streak_count em si (o loop mais abaixo) e byte-a-byte identica a 0039.
--
-- Bug real, secundario, corrigido de passagem: o branch "already_finalized"
-- (retorno idempotente quando o dia ja estava finalizado) nunca incluia
-- streak_current/streak_best no json, embora RawFinalizeSummary (TS) os
-- declare obrigatorios - uma finalizacao repetida (retry/duplo clique)
-- devolvia esses campos como undefined em tempo de execucao. Corrigido
-- reaproveitando os valores ja lidos de challenge_enrollments no SELECT
-- inicial (ce.streak_current/ce.streak_best), sem recalcular nada.
create or replace function public.finalize_daily_log_with_responses(
  target_daily_log_id uuid,
  responses jsonb default '[]'::jsonb
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
  habit_row record;
  point_habit_record record;
  saved_habit_log_id uuid;
  normalized_value jsonb;
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
  new_user_achievement_id uuid;
  halfway_target integer := 0;
  habit_results jsonb := '[]'::jsonb;
  responses_count integer := 0;
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

  -- Movido para antes do retorno idempotente (era calculado so mais tarde,
  -- em 0039) - assim os dois branches de retorno (ja finalizado / recem
  -- finalizado) sempre devolvem o mesmo streak_minimum_completion real do
  -- ciclo, nunca o default hardcoded da declaracao acima.
  streak_minimum_completion := public.journey_rule_int(
    daily_record.rules_config,
    'streak_minimum_completion',
    70
  )::numeric(5, 2);

  if daily_record.status = 'finalized' then
    select coalesce(sum(points), 0)
    into v_points_earned
    from public.point_events
    where daily_log_id = daily_record.id;

    select coalesce(jsonb_agg(jsonb_build_object('habit_id', hl.habit_id, 'status', hl.status)), '[]'::jsonb)
    into habit_results
    from public.habit_logs hl
    where hl.daily_log_id = daily_record.id;

    return jsonb_build_object(
      'daily_log_id', daily_record.id,
      'status', 'finalized',
      'already_finalized', true,
      'completion_percent', daily_record.completion_percent,
      'points_earned', v_points_earned,
      'streak_current', daily_record.streak_current,
      'streak_best', daily_record.streak_best,
      'streak_minimum_completion', streak_minimum_completion,
      'streak_met_minimum', daily_record.completion_percent >= streak_minimum_completion,
      'unlocked_achievements', unlocked_achievements,
      'habit_results', habit_results
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

  if jsonb_typeof(coalesce(responses, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Respostas em formato invalido.'
      using errcode = '22023';
  end if;

  select count(*) into responses_count from jsonb_array_elements(coalesce(responses, '[]'::jsonb));

  if responses_count > 200 then
    raise exception 'Numero de respostas excede o limite permitido.'
      using errcode = '22023';
  end if;

  for habit_row in
    with input_responses as (
      select
        (elem ->> 'habit_id')::uuid as habit_id,
        lower(coalesce(elem ->> 'status', 'pending')) as raw_status,
        nullif(left(coalesce(elem ->> 'note', ''), 1200), '') as note
      from jsonb_array_elements(coalesce(responses, '[]'::jsonb)) as elem
      where elem ->> 'habit_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    select
      h.id as habit_id,
      h.habit_type,
      cdh.required,
      case
        when ir.raw_status = 'completed' then 'completed'::public.habit_log_status
        when ir.raw_status = 'not_applicable' and not cdh.required then 'not_applicable'::public.habit_log_status
        else 'pending'::public.habit_log_status
      end as resolved_status,
      ir.note
    from public.challenge_day_habits cdh
    join public.habits h on h.id = cdh.habit_id
    left join input_responses ir on ir.habit_id = h.id
    where cdh.challenge_day_id = daily_record.challenge_day_id
      and h.active
  loop
    if habit_row.habit_type in ('quantity'::public.habit_type, 'duration'::public.habit_type) then
      normalized_value := case
        when habit_row.resolved_status = 'completed'::public.habit_log_status
          then jsonb_build_object('value', 1)
        else '{}'::jsonb
      end;
    elsif habit_row.habit_type in ('boolean'::public.habit_type, 'reading'::public.habit_type) then
      normalized_value := case
        when habit_row.resolved_status = 'completed'::public.habit_log_status
          then jsonb_build_object('completed', true)
        else '{}'::jsonb
      end;
    else
      normalized_value := '{}'::jsonb;
    end if;

    insert into public.habit_logs (
      daily_log_id, challenge_day_id, habit_id, status, value_json, note, completed_at
    )
    values (
      daily_record.id,
      daily_record.challenge_day_id,
      habit_row.habit_id,
      habit_row.resolved_status,
      normalized_value,
      habit_row.note,
      case when habit_row.resolved_status = 'completed'::public.habit_log_status then now() else null end
    )
    on conflict (daily_log_id, habit_id) do update
      set status = excluded.status,
          value_json = excluded.value_json,
          note = excluded.note,
          completed_at = excluded.completed_at,
          updated_at = now()
    returning id into saved_habit_log_id;

    habit_results := habit_results || jsonb_build_array(
      jsonb_build_object('habit_id', habit_row.habit_id, 'status', habit_row.resolved_status)
    );
  end loop;

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

  select *
  into journal_record
  from public.journal_entries
  where daily_log_id = daily_record.id
  limit 1;

  if journal_record.id is not null then
    journal_completed := public.journey_has_journal_content(journal_record);
  end if;

  for point_habit_record in
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
      point_habit_record.id,
      point_habit_record.points,
      daily_record.enrollment_id || ':' || daily_record.id || ':habit:' || point_habit_record.id,
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
      new_user_achievement_id := null;

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
      on conflict (user_id, enrollment_id, achievement_id) do nothing
      returning id into new_user_achievement_id;

      if found then
        unlocked_achievements := unlocked_achievements || jsonb_build_array(
          jsonb_build_object(
            'id', achievement_record.id,
            'user_achievement_id', new_user_achievement_id,
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
    'streak_minimum_completion', streak_minimum_completion,
    'streak_met_minimum', completion_percent >= streak_minimum_completion,
    'unlocked_achievements', unlocked_achievements,
    'habit_results', habit_results
  );
end;
$$;

revoke all on function public.finalize_daily_log_with_responses(uuid, jsonb) from public, anon;
grant execute on function public.finalize_daily_log_with_responses(uuid, jsonb) to authenticated;

comment on function public.finalize_daily_log_with_responses(uuid, jsonb) is
  'Batches all habit responses for a day into one transactional finalize '
  'call. Same behavior as 0039 (calculo de streak inalterado byte-a-byte) - '
  'adiciona streak_minimum_completion e streak_met_minimum ao retorno para '
  'que a UI explique por que a sequencia avancou ou nao, em vez de mostrar '
  'apenas um numero sem contexto. Idempotent: an already-finalized day '
  'returns early with an empty unlocked_achievements list, now also '
  'including streak_current/streak_best/streak_minimum_completion/'
  'streak_met_minimum (faltavam antes, apesar de o tipo TS do cliente ja '
  'os exigir).';
