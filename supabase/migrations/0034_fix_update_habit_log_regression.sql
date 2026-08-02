-- Fix a real production regression: every "Marcar como realizado" click has
-- been failing with "Acao nao salva" since 0030_challenge_lifecycle_rpcs.sql
-- shipped. Root cause (confirmed by reproducing the exact call inside a
-- rolled-back transaction against the linked database, simulating the real
-- signed-in user via request.jwt.claims):
--
--   ERROR: 23502: null value in column "challenge_day_id" of relation
--   "habit_logs" violates not-null constraint
--
-- 0030 fully rewrote public.update_habit_log() to add the new
-- challenge_status guard (Module C: a whole-challenge pause must also block
-- habit edits on an already-open daily_log), but the rewrite was based on an
-- incomplete copy of the function body - it silently dropped several things
-- the 0016_analytics_events_instrumentation.sql version had correct:
--   1. challenge_day_id was removed from the INSERT into habit_logs. That
--      column is `not null` with no default (confirmed via
--      information_schema.columns) - every single insert has been failing
--      ever since, for every user, every habit, on every challenge. This is
--      the actual root cause of "Acao nao salva".
--   2. habit_type allow-list validation (boolean/duration/quantity/reading).
--   3. target_status allow-list validation.
--   4. The not_applicable-on-a-required-habit guard.
--   5. Numeric value_json validation/normalization for quantity/duration
--      habits, and completed/not-completed normalization for boolean/reading
--      habits.
--   6. completed_at timestamp population.
--   7. The challenge_first_habit_completed analytics event and the
--      habit_log_id/status fields in the returned payload.
--
-- This migration restores all of the above from 0016 (byte-for-byte where
-- unrelated to the fix) and keeps 0030's two legitimate additions unchanged:
-- the challenge_status check, and cdh.required now being read via
-- habit_record (already correct in 0030, not touched here). No points,
-- streak, completion-rate or achievement-unlock FORMULA is changed by this
-- migration - this only restores code that was accidentally deleted, it
-- does not alter any rule.
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
    ce.user_id,
    c.status as challenge_status
  into daily_record
  from public.daily_logs dl
  join public.challenge_enrollments ce on ce.id = dl.enrollment_id
  join public.challenges c on c.id = dl.challenge_id
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

  -- Kept from 0030 (Module C): a whole-challenge pause must also block habit
  -- edits on a daily_log opened before the pause.
  if daily_record.challenge_status <> 'active'::public.challenge_status then
    raise exception 'O ciclo nao esta ativo para editar habitos.'
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
        completed_at = excluded.completed_at,
        updated_at = now()
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

comment on function public.update_habit_log(uuid, uuid, public.habit_log_status, jsonb, text) is
  'Fixed 2026-08: 0030 dropped challenge_day_id from the habit_logs INSERT '
  '(not-null, no default), plus several validations and the '
  'challenge_first_habit_completed event. Restored from 0016, keeping '
  '0030''s challenge_status guard. See migration header for full detail.';
