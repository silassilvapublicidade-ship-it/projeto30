-- Module C: the actual pause/resume/end RPCs, plus the calendar-offset
-- plumbing through the journey engine. Two concepts, kept deliberately
-- separate per the brief:
--   1) whole-challenge pause/resume/end (admin_pause_challenge,
--      admin_resume_challenge, admin_end_challenge) - affects every
--      enrollment in the challenge.
--   2) a single participant's enrollment pause/resume (admin_pause_enrollment,
--      admin_resume_enrollment) - admin-only this round, by explicit product
--      choice in the brief ("usuario continua apenas com Abandonar").
-- Both share one mechanism: challenge_enrollments.paused_days_offset
-- (0029), applied inside journey_calculate_day so a pause - whichever kind -
-- never costs a participant real progress days. The offset is computed in
-- whole calendar days (now()::date - paused_at::date), not per-enrollment
-- timezone precision - a reasonable approximation given journey_get_local_date
-- already handles the *current* day correctly per user; only the pause
-- *duration* itself is a day-level approximation.

-- create or replace can't turn the existing 2-arg function into this 3-arg
-- one (different signature = different overload in Postgres) - drop the old
-- overload explicitly so it doesn't linger as dead code once
-- ensure_today_daily_log (the only caller) is updated below to pass 3 args.
drop function if exists public.journey_calculate_day(date, date);

create or replace function public.journey_calculate_day(
  target_start_date date,
  target_local_date date,
  p_paused_days_offset integer default 0
)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select (target_local_date - target_start_date) + 1 - coalesce(p_paused_days_offset, 0);
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
    ce.id, ce.challenge_id, ce.personal_start_date, ce.status,
    ce.paused_days_offset,
    c.duration_days, c.rules_config, c.status as challenge_status,
    c.start_date, u.timezone
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

  if enrollment_record.start_date is not null and local_date < enrollment_record.start_date then
    raise exception 'Este desafio ainda nao comecou oficialmente.'
      using errcode = 'P0005';
  end if;

  calculated_day := public.journey_calculate_day(
    enrollment_record.personal_start_date, local_date, enrollment_record.paused_days_offset
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
    enrollment_id, challenge_id, challenge_day_id, log_date, rules_snapshot
  )
  values (
    enrollment_record.id, enrollment_record.challenge_id,
    selected_challenge_day_id, local_date, enrollment_record.rules_config
  )
  on conflict do nothing
  returning id into daily_log_id;

  if daily_log_id is null then
    select id into daily_log_id
    from public.daily_logs existing_dl
    where existing_dl.enrollment_id = enrollment_record.id
      and existing_dl.challenge_day_id = selected_challenge_day_id
    limit 1;
  end if;

  if daily_log_id is null then
    select id into daily_log_id
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

  -- New in Module C: previously only enrollment_status was checked here, so
  -- a whole-challenge pause never actually stopped habit edits on a daily_log
  -- opened before the pause - only ensure_today_daily_log (creating a NEW
  -- log) and finalize_daily_log were covered.
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
    raise exception 'Habito nao encontrado para este dia.'
      using errcode = 'P0002';
  end if;

  insert into public.habit_logs (
    daily_log_id, habit_id, status, value_json, note
  )
  values (
    daily_record.id, target_habit_id, target_status, normalized_value, normalized_note
  )
  on conflict (daily_log_id, habit_id) do update
    set status = excluded.status,
        value_json = excluded.value_json,
        note = excluded.note,
        updated_at = now()
  returning id into saved_habit_log_id;

  progress := public.journey_recalculate_daily_log(daily_record.id);

  return progress;
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

  if daily_record.status = 'finalized'
    and (daily_record.editable_until is null or now() > daily_record.editable_until) then
    raise exception 'A reflexao deste dia nao pode mais ser alterada.'
      using errcode = '22023';
  end if;

  -- New in Module C: challenge_status now checked alongside enrollment_status
  -- (previously only enrollment_status), same reasoning as update_habit_log.
  if daily_record.status <> 'finalized'::public.daily_log_status
    and (
      daily_record.enrollment_status <> 'active'::public.enrollment_status
      or daily_record.challenge_status <> 'active'::public.challenge_status
    ) then
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

-- record_analytics_event: whitelist extended with the 5 new lifecycle
-- events (0029 already extended the table CHECK constraint to match).
create or replace function public.record_analytics_event(
  p_event_name text,
  p_challenge_id uuid default null,
  p_enrollment_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_session_id text default null,
  p_source text default 'client'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  inserted_id uuid;
begin
  if p_event_name is null or p_event_name not in (
    'challenge_catalog_viewed',
    'challenge_detail_viewed',
    'challenge_join_clicked',
    'challenge_joined',
    'challenge_first_habit_completed',
    'challenge_day_completed',
    'challenge_day_7_reached',
    'challenge_halfway_reached',
    'challenge_completed',
    'challenge_abandoned',
    'share_achievement_started',
    'share_achievement_completed',
    'challenge_paused',
    'challenge_resumed',
    'challenge_ended',
    'enrollment_paused',
    'enrollment_resumed'
  ) then
    raise exception 'Nome de evento nao permitido.'
      using errcode = '22023';
  end if;

  if p_source not in ('server', 'client') then
    raise exception 'Origem de evento invalida.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(normalized_metadata) <> 'object' then
    raise exception 'Metadata de evento precisa ser um objeto JSON.'
      using errcode = '22023';
  end if;

  insert into public.analytics_events (
    user_id, event_name, challenge_id, enrollment_id, metadata, session_id, source
  )
  values (
    actor_id, p_event_name, p_challenge_id, p_enrollment_id, normalized_metadata,
    nullif(trim(coalesce(p_session_id, '')), ''), p_source
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Whole-challenge lifecycle (admin only)
-- ---------------------------------------------------------------------

create or replace function public.admin_pause_challenge(
  p_challenge_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old_status public.challenge_status;
begin
  perform public.admin_require_admin();

  select status into v_old_status
  from public.challenges
  where id = p_challenge_id
    and deleted_at is null
  for update;

  if v_old_status is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  if v_old_status <> 'active' then
    raise exception 'Apenas desafios ativos podem ser pausados.'
      using errcode = 'P0003';
  end if;

  update public.challenges
  set status = 'paused', paused_at = now(), updated_at = now()
  where id = p_challenge_id;

  perform public.record_analytics_event(
    'challenge_paused', p_challenge_id, null, '{}'::jsonb, null, 'server'
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    v_admin_id, 'admin_pause_challenge', 'challenge', p_challenge_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'paused')
  );
end;
$$;

create or replace function public.admin_resume_challenge(
  p_challenge_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old_status public.challenge_status;
  v_paused_at timestamptz;
  v_pause_days integer;
begin
  perform public.admin_require_admin();

  select status, paused_at into v_old_status, v_paused_at
  from public.challenges
  where id = p_challenge_id
    and deleted_at is null
  for update;

  if v_old_status is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  if v_old_status <> 'paused' then
    raise exception 'Apenas desafios pausados podem ser retomados.'
      using errcode = 'P0003';
  end if;

  v_pause_days := greatest(0, (now()::date - coalesce(v_paused_at, now())::date));

  -- Credits every currently active/paused enrollment in this challenge with
  -- the pause duration, so nobody's calendar loses those days - whether
  -- they were mid-cycle or themselves individually paused when the
  -- whole-challenge pause hit.
  update public.challenge_enrollments
  set paused_days_offset = paused_days_offset + v_pause_days,
      updated_at = now()
  where challenge_id = p_challenge_id
    and status in ('active', 'paused');

  update public.challenges
  set status = 'active', paused_at = null, updated_at = now()
  where id = p_challenge_id;

  perform public.record_analytics_event(
    'challenge_resumed', p_challenge_id, null,
    jsonb_build_object('pause_days_credited', v_pause_days), null, 'server'
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    v_admin_id, 'admin_resume_challenge', 'challenge', p_challenge_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'active', 'pause_days_credited', v_pause_days)
  );
end;
$$;

create or replace function public.admin_end_challenge(
  p_challenge_id uuid,
  p_confirmation_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_name text;
  v_old_status public.challenge_status;
begin
  perform public.admin_require_admin();

  select name, status into v_name, v_old_status
  from public.challenges
  where id = p_challenge_id
    and deleted_at is null
  for update;

  if v_name is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  if v_old_status not in ('active', 'paused') then
    raise exception 'Apenas desafios ativos ou pausados podem ser encerrados.'
      using errcode = 'P0003';
  end if;

  if p_confirmation_name is null or trim(p_confirmation_name) <> v_name then
    raise exception 'O nome informado nao confere com o nome do desafio.'
      using errcode = 'P0008';
  end if;

  update public.challenges
  set status = 'ended', ended_at = now(), paused_at = null, updated_at = now()
  where id = p_challenge_id;

  perform public.record_analytics_event(
    'challenge_ended', p_challenge_id, null, '{}'::jsonb, null, 'server'
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    v_admin_id, 'admin_end_challenge', 'challenge', p_challenge_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'ended')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Individual enrollment pause/resume (admin only this round)
-- ---------------------------------------------------------------------

create or replace function public.admin_pause_enrollment(
  p_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old_status public.enrollment_status;
  v_challenge_id uuid;
begin
  perform public.admin_require_admin();

  select status, challenge_id into v_old_status, v_challenge_id
  from public.challenge_enrollments
  where id = p_enrollment_id
  for update;

  if v_old_status is null then
    raise exception 'Inscricao nao encontrada.'
      using errcode = 'P0002';
  end if;

  if v_old_status <> 'active' then
    raise exception 'Apenas inscricoes ativas podem ser pausadas.'
      using errcode = 'P0003';
  end if;

  update public.challenge_enrollments
  set status = 'paused', paused_at = now(), updated_at = now()
  where id = p_enrollment_id;

  perform public.record_analytics_event(
    'enrollment_paused', v_challenge_id, p_enrollment_id, '{}'::jsonb, null, 'server'
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    v_admin_id, 'admin_pause_enrollment', 'enrollment', p_enrollment_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'paused')
  );
end;
$$;

create or replace function public.admin_resume_enrollment(
  p_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old_status public.enrollment_status;
  v_challenge_id uuid;
  v_paused_at timestamptz;
  v_pause_days integer;
begin
  perform public.admin_require_admin();

  select status, challenge_id, paused_at
  into v_old_status, v_challenge_id, v_paused_at
  from public.challenge_enrollments
  where id = p_enrollment_id
  for update;

  if v_old_status is null then
    raise exception 'Inscricao nao encontrada.'
      using errcode = 'P0002';
  end if;

  if v_old_status <> 'paused' then
    raise exception 'Apenas inscricoes pausadas podem ser retomadas.'
      using errcode = 'P0003';
  end if;

  v_pause_days := greatest(0, (now()::date - coalesce(v_paused_at, now())::date));

  update public.challenge_enrollments
  set status = 'active',
      paused_days_offset = paused_days_offset + v_pause_days,
      paused_at = null,
      updated_at = now()
  where id = p_enrollment_id;

  perform public.record_analytics_event(
    'enrollment_resumed', v_challenge_id, p_enrollment_id,
    jsonb_build_object('pause_days_credited', v_pause_days), null, 'server'
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    v_admin_id, 'admin_resume_enrollment', 'enrollment', p_enrollment_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'active', 'pause_days_credited', v_pause_days)
  );
end;
$$;

revoke all on function public.admin_pause_challenge(uuid) from public, anon;
revoke all on function public.admin_resume_challenge(uuid) from public, anon;
revoke all on function public.admin_end_challenge(uuid, text) from public, anon;
revoke all on function public.admin_pause_enrollment(uuid) from public, anon;
revoke all on function public.admin_resume_enrollment(uuid) from public, anon;

grant execute on function public.admin_pause_challenge(uuid) to authenticated;
grant execute on function public.admin_resume_challenge(uuid) to authenticated;
grant execute on function public.admin_end_challenge(uuid, text) to authenticated;
grant execute on function public.admin_pause_enrollment(uuid) to authenticated;
grant execute on function public.admin_resume_enrollment(uuid) to authenticated;
