-- Fase 2: funcoes somente-leitura para o painel administrativo (dashboard,
-- lista/detalhe de desafios, lista/detalhe de participantes).
--
-- Todas as funcoes sao security definer (para poder agregar dados entre
-- tabelas sem depender de RLS por linha) mas cada uma valida
-- explicitamente public.is_admin() antes de devolver qualquer dado. Isso
-- segue o mesmo padrao ja usado pelas RPCs de jornada (0002_daily_journey_core.sql):
-- security definer + checagem de autorizacao no corpo da funcao, nunca no
-- lado do cliente.
--
-- Janela de "atividade recente" usada para participante ativo/inativo: 3 dias
-- sem nenhum daily_log atualizado. Documentada aqui e em docs/admin-analytics.md.

create or replace function public.admin_require_admin()
returns public.user_role
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_role public.user_role;
begin
  v_current_role := public.current_user_role();

  if v_current_role not in ('admin', 'super_admin') then
    raise exception 'Apenas administradores podem acessar estes dados.'
      using errcode = '42501';
  end if;

  return v_current_role;
end;
$$;

create or replace function public.admin_dashboard_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_window constant interval := interval '3 days';
  v_challenges_draft integer;
  v_challenges_active integer;
  v_challenges_ended integer;
  v_challenges_total integer;
  v_total_enrollments integer;
  v_active_participants integer;
  v_participants_completed_one_day integer;
  v_participants_completed_challenge integer;
  v_avg_progress numeric(5, 2);
  v_total_finalized_days integer;
begin
  perform public.admin_require_admin();

  select
    count(*) filter (where status = 'draft'),
    count(*) filter (where status = 'active'),
    count(*) filter (where status in ('ended', 'archived')),
    count(*)
  into
    v_challenges_draft,
    v_challenges_active,
    v_challenges_ended,
    v_challenges_total
  from public.challenges
  where deleted_at is null;

  select count(*)
  into v_total_enrollments
  from public.challenge_enrollments;

  select count(*)
  into v_active_participants
  from public.challenge_enrollments ce
  where ce.status = 'active'
    and exists (
      select 1
      from public.daily_logs dl
      where dl.enrollment_id = ce.id
        and dl.updated_at >= now() - v_active_window
    );

  select count(distinct enrollment_id)
  into v_participants_completed_one_day
  from public.daily_logs
  where status = 'finalized';

  select count(*)
  into v_participants_completed_challenge
  from public.challenge_enrollments
  where status = 'completed';

  select round(coalesce(avg(completion_percent), 0), 2)
  into v_avg_progress
  from public.challenge_enrollments;

  select count(*)
  into v_total_finalized_days
  from public.daily_logs
  where status = 'finalized';

  return jsonb_build_object(
    'challenges_total', v_challenges_total,
    'challenges_draft', v_challenges_draft,
    'challenges_active', v_challenges_active,
    'challenges_ended_or_archived', v_challenges_ended,
    'total_enrollments', v_total_enrollments,
    'active_participants', v_active_participants,
    'participants_completed_one_day', v_participants_completed_one_day,
    'participants_completed_challenge', v_participants_completed_challenge,
    'average_progress_percent', v_avg_progress,
    'total_finalized_days', v_total_finalized_days,
    'active_window_days', 3
  );
end;
$$;

create or replace function public.admin_list_challenges(
  p_search text default null,
  p_status public.challenge_status default null,
  p_sort_by text default 'created_at',
  p_sort_dir text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  status public.challenge_status,
  start_date date,
  end_date date,
  duration_days integer,
  created_at timestamptz,
  participant_count bigint,
  average_progress numeric,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sort_by text := lower(coalesce(p_sort_by, 'created_at'));
  v_sort_dir text := lower(coalesce(p_sort_dir, 'desc'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.admin_require_admin();

  if v_sort_by not in ('created_at', 'participant_count', 'average_progress', 'name') then
    v_sort_by := 'created_at';
  end if;

  if v_sort_dir not in ('asc', 'desc') then
    v_sort_dir := 'desc';
  end if;

  return query execute format(
    $q$
      select
        c.id,
        c.name,
        c.slug,
        c.status,
        c.start_date,
        c.end_date,
        c.duration_days,
        c.created_at,
        coalesce(stats.participant_count, 0) as participant_count,
        coalesce(stats.average_progress, 0) as average_progress,
        count(*) over() as total_count
      from public.challenges c
      left join lateral (
        select
          count(*) as participant_count,
          round(avg(ce.completion_percent), 2) as average_progress
        from public.challenge_enrollments ce
        where ce.challenge_id = c.id
      ) stats on true
      where c.deleted_at is null
        and ($1 is null or c.status = $1)
        and (
          $2 is null
          or c.name ilike '%%' || $2 || '%%'
          or c.slug ilike '%%' || $2 || '%%'
        )
      order by %I %s nulls last, c.id asc
      limit $3
      offset $4
    $q$,
    v_sort_by,
    v_sort_dir
  )
  using p_status, nullif(trim(coalesce(p_search, '')), ''), v_limit, v_offset;
end;
$$;

create or replace function public.admin_challenge_detail(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_window constant interval := interval '3 days';
  v_challenge record;
  v_total_enrolled integer;
  v_active integer;
  v_inactive integer;
  v_completed integer;
  v_avg_progress numeric(5, 2);
  v_avg_points numeric(10, 2);
  v_avg_streak numeric(10, 2);
  v_best_streak integer;
  v_finalized_days integer;
  v_completion_rate numeric(5, 2);
  v_enrollment_evolution jsonb;
  v_daily_completion jsonb;
  v_habit_adherence jsonb;
  v_progress_distribution jsonb;
begin
  perform public.admin_require_admin();

  select c.id, c.name, c.slug, c.status, c.duration_days, c.start_date, c.end_date, c.created_at
  into v_challenge
  from public.challenges c
  where c.id = p_challenge_id
    and c.deleted_at is null;

  if v_challenge.id is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  select count(*)
  into v_total_enrolled
  from public.challenge_enrollments
  where challenge_id = p_challenge_id;

  select count(*)
  into v_active
  from public.challenge_enrollments ce
  where ce.challenge_id = p_challenge_id
    and ce.status = 'active'
    and exists (
      select 1 from public.daily_logs dl
      where dl.enrollment_id = ce.id
        and dl.updated_at >= now() - v_active_window
    );

  select count(*)
  into v_completed
  from public.challenge_enrollments
  where challenge_id = p_challenge_id
    and status = 'completed';

  v_inactive := greatest(v_total_enrolled - v_active - v_completed, 0);

  select
    round(coalesce(avg(completion_percent), 0), 2),
    round(coalesce(avg(points_total), 0), 2),
    round(coalesce(avg(streak_current), 0), 2),
    coalesce(max(streak_best), 0)
  into v_avg_progress, v_avg_points, v_avg_streak, v_best_streak
  from public.challenge_enrollments
  where challenge_id = p_challenge_id;

  select count(*)
  into v_finalized_days
  from public.daily_logs
  where challenge_id = p_challenge_id
    and status = 'finalized';

  v_completion_rate := case
    when v_total_enrolled = 0 then 0
    else round((v_completed::numeric / v_total_enrolled::numeric) * 100, 2)
  end;

  select coalesce(jsonb_agg(row_to_json(evolution) order by evolution.enrollment_day), '[]'::jsonb)
  into v_enrollment_evolution
  from (
    select
      date_trunc('day', joined_at)::date as enrollment_day,
      count(*) as enrollments
    from public.challenge_enrollments
    where challenge_id = p_challenge_id
    group by 1
    order by 1 desc
    limit 60
  ) evolution;

  select coalesce(jsonb_agg(row_to_json(daily) order by daily.day_number), '[]'::jsonb)
  into v_daily_completion
  from (
    select
      cd.day_number,
      count(dl.id) filter (where dl.status = 'finalized') as finalized_count,
      count(dl.id) as opened_count
    from public.challenge_days cd
    left join public.daily_logs dl
      on dl.challenge_day_id = cd.id
      and dl.challenge_id = p_challenge_id
    where cd.challenge_id = p_challenge_id
    group by cd.day_number
    order by cd.day_number
  ) daily;

  select coalesce(jsonb_agg(row_to_json(adherence) order by adherence.adherence_percent desc), '[]'::jsonb)
  into v_habit_adherence
  from (
    select
      h.id as habit_id,
      h.title,
      count(dl.id) filter (
        where coalesce(hl.status, 'pending'::public.habit_log_status) <> 'not_applicable'
      ) as opportunity_count,
      count(dl.id) filter (where hl.status = 'completed') as completed_count,
      case
        when count(dl.id) filter (
          where coalesce(hl.status, 'pending'::public.habit_log_status) <> 'not_applicable'
        ) = 0 then 0
        else round(
          (
            count(dl.id) filter (where hl.status = 'completed')::numeric
            / count(dl.id) filter (
              where coalesce(hl.status, 'pending'::public.habit_log_status) <> 'not_applicable'
            )::numeric
          ) * 100,
          2
        )
      end as adherence_percent
    from public.habits h
    join public.challenge_day_habits cdh on cdh.habit_id = h.id and cdh.challenge_id = h.challenge_id
    join public.daily_logs dl on dl.challenge_day_id = cdh.challenge_day_id and dl.challenge_id = h.challenge_id
    left join public.habit_logs hl on hl.daily_log_id = dl.id and hl.habit_id = h.id
    where h.challenge_id = p_challenge_id
    group by h.id, h.title
  ) adherence;

  select coalesce(jsonb_agg(row_to_json(distribution) order by distribution.bucket_order), '[]'::jsonb)
  into v_progress_distribution
  from (
    select
      bucket_order,
      bucket_label,
      count(*) as participant_count
    from public.challenge_enrollments ce
    cross join lateral (
      select
        case
          when ce.completion_percent <= 20 then 1
          when ce.completion_percent <= 40 then 2
          when ce.completion_percent <= 60 then 3
          when ce.completion_percent <= 80 then 4
          else 5
        end as bucket_order,
        case
          when ce.completion_percent <= 20 then '0-20%'
          when ce.completion_percent <= 40 then '21-40%'
          when ce.completion_percent <= 60 then '41-60%'
          when ce.completion_percent <= 80 then '61-80%'
          else '81-100%'
        end as bucket_label
    ) bucket
    where ce.challenge_id = p_challenge_id
    group by bucket_order, bucket_label
  ) distribution;

  return jsonb_build_object(
    'challenge', jsonb_build_object(
      'id', v_challenge.id,
      'name', v_challenge.name,
      'slug', v_challenge.slug,
      'status', v_challenge.status,
      'duration_days', v_challenge.duration_days,
      'start_date', v_challenge.start_date,
      'end_date', v_challenge.end_date,
      'created_at', v_challenge.created_at
    ),
    'total_enrolled', v_total_enrolled,
    'active_participants', v_active,
    'inactive_participants', v_inactive,
    'completed_participants', v_completed,
    'average_progress_percent', v_avg_progress,
    'average_points', v_avg_points,
    'average_streak', v_avg_streak,
    'best_streak', v_best_streak,
    'finalized_days', v_finalized_days,
    'completion_rate_percent', v_completion_rate,
    'enrollment_evolution', v_enrollment_evolution,
    'daily_completion', v_daily_completion,
    'habit_adherence', v_habit_adherence,
    'progress_distribution', v_progress_distribution,
    'active_window_days', 3
  );
end;
$$;

create or replace function public.admin_list_participants(
  p_challenge_id uuid,
  p_search text default null,
  p_status public.enrollment_status default null,
  p_activity text default null,
  p_min_progress numeric default null,
  p_max_progress numeric default null,
  p_sort_by text default 'joined_at',
  p_sort_dir text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  enrollment_id uuid,
  user_id uuid,
  name text,
  email text,
  joined_at timestamptz,
  status public.enrollment_status,
  activity text,
  finalized_days bigint,
  completion_percent numeric,
  points_total integer,
  streak_current integer,
  streak_best integer,
  last_activity_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_window constant interval := interval '3 days';
  v_sort_by text := lower(coalesce(p_sort_by, 'joined_at'));
  v_sort_dir text := lower(coalesce(p_sort_dir, 'desc'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.admin_require_admin();

  if v_sort_by not in ('joined_at', 'completion_percent', 'points_total', 'streak_current', 'last_activity_at') then
    v_sort_by := 'joined_at';
  end if;

  if v_sort_dir not in ('asc', 'desc') then
    v_sort_dir := 'desc';
  end if;

  return query execute format(
    $q$
      select
        base.enrollment_id,
        base.user_id,
        base.name,
        base.email,
        base.joined_at,
        base.status,
        base.activity,
        base.finalized_days,
        base.completion_percent,
        base.points_total,
        base.streak_current,
        base.streak_best,
        base.last_activity_at,
        count(*) over() as total_count
      from (
        select
          ce.id as enrollment_id,
          ce.user_id,
          u.name,
          u.email::text as email,
          ce.joined_at,
          ce.status,
          case
            when ce.status = 'completed' then 'completed'
            when ce.status = 'active' and activity_stats.last_activity_at >= now() - $9 then 'active'
            else 'inactive'
          end as activity,
          coalesce(activity_stats.finalized_days, 0) as finalized_days,
          ce.completion_percent,
          ce.points_total,
          ce.streak_current,
          ce.streak_best,
          activity_stats.last_activity_at
        from public.challenge_enrollments ce
        join public.users u on u.id = ce.user_id
        left join lateral (
          select
            max(dl.updated_at) as last_activity_at,
            count(*) filter (where dl.status = 'finalized') as finalized_days
          from public.daily_logs dl
          where dl.enrollment_id = ce.id
        ) activity_stats on true
        where ce.challenge_id = $1
      ) base
      where ($2 is null or base.status = $2)
        and (
          $3 is null
          or base.name ilike '%%' || $3 || '%%'
          or base.email ilike '%%' || $3 || '%%'
        )
        and ($4 is null or base.activity = $4)
        and ($5 is null or base.completion_percent >= $5)
        and ($6 is null or base.completion_percent <= $6)
      order by %I %s nulls last, base.enrollment_id asc
      limit $7
      offset $8
    $q$,
    v_sort_by,
    v_sort_dir
  )
  using
    p_challenge_id,
    p_status,
    nullif(trim(coalesce(p_search, '')), ''),
    nullif(trim(coalesce(p_activity, '')), ''),
    p_min_progress,
    p_max_progress,
    v_limit,
    v_offset,
    v_active_window;
end;
$$;

create or replace function public.admin_participant_detail(
  p_enrollment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_window constant interval := interval '3 days';
  v_role public.user_role;
  v_enrollment record;
  v_daily_history jsonb;
  v_achievements jsonb;
  v_reflections jsonb := null;
begin
  v_role := public.admin_require_admin();

  select
    ce.id,
    ce.user_id,
    u.name,
    u.email::text as email,
    ce.challenge_id,
    c.name as challenge_name,
    c.duration_days,
    ce.personal_start_date,
    ce.joined_at,
    ce.status,
    ce.completion_percent,
    ce.points_total,
    ce.streak_current,
    ce.streak_best,
    ce.completed_at,
    (
      select max(dl.updated_at)
      from public.daily_logs dl
      where dl.enrollment_id = ce.id
    ) as last_activity_at
  into v_enrollment
  from public.challenge_enrollments ce
  join public.users u on u.id = ce.user_id
  join public.challenges c on c.id = ce.challenge_id
  where ce.id = p_enrollment_id;

  if v_enrollment.id is null then
    raise exception 'Participante nao encontrado.'
      using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(row_to_json(history) order by history.day_number), '[]'::jsonb)
  into v_daily_history
  from (
    select
      cd.day_number,
      dl.id as daily_log_id,
      dl.status,
      dl.completion_percent,
      dl.points_earned,
      dl.log_date,
      dl.finalized_at
    from public.challenge_days cd
    left join public.daily_logs dl
      on dl.challenge_day_id = cd.id
      and dl.enrollment_id = p_enrollment_id
    where cd.challenge_id = v_enrollment.challenge_id
    order by cd.day_number
  ) history;

  select coalesce(jsonb_agg(row_to_json(unlocked) order by unlocked.unlocked_at), '[]'::jsonb)
  into v_achievements
  from (
    select
      a.name,
      a.slug,
      a.icon,
      ua.unlocked_at
    from public.user_achievements ua
    join public.achievements a on a.id = ua.achievement_id
    where ua.enrollment_id = p_enrollment_id
  ) unlocked;

  if v_role = 'super_admin' then
    select coalesce(jsonb_agg(row_to_json(entry) order by entry.log_date), '[]'::jsonb)
    into v_reflections
    from (
      select
        dl.log_date,
        je.content,
        je.gratitude,
        je.difficulty,
        je.victory,
        je.tomorrow_focus,
        je.mood
      from public.journal_entries je
      join public.daily_logs dl on dl.id = je.daily_log_id
      where je.enrollment_id = p_enrollment_id
    ) entry;
  end if;

  return jsonb_build_object(
    'enrollment_id', v_enrollment.id,
    'user_id', v_enrollment.user_id,
    'name', v_enrollment.name,
    'email', v_enrollment.email,
    'challenge_id', v_enrollment.challenge_id,
    'challenge_name', v_enrollment.challenge_name,
    'duration_days', v_enrollment.duration_days,
    'personal_start_date', v_enrollment.personal_start_date,
    'joined_at', v_enrollment.joined_at,
    'status', v_enrollment.status,
    'completion_percent', v_enrollment.completion_percent,
    'points_total', v_enrollment.points_total,
    'streak_current', v_enrollment.streak_current,
    'streak_best', v_enrollment.streak_best,
    'completed_at', v_enrollment.completed_at,
    'last_activity_at', v_enrollment.last_activity_at,
    'activity', case
      when v_enrollment.status = 'completed' then 'completed'
      when v_enrollment.status = 'active' and v_enrollment.last_activity_at >= now() - v_active_window then 'active'
      else 'inactive'
    end,
    'daily_history', v_daily_history,
    'achievements', v_achievements,
    'reflections_visible', v_role = 'super_admin',
    'reflections', v_reflections
  );
end;
$$;

revoke execute on function public.admin_require_admin() from public, anon, authenticated;
revoke execute on function public.admin_dashboard_overview() from public, anon, authenticated;
revoke execute on function public.admin_list_challenges(
  text, public.challenge_status, text, text, integer, integer
) from public, anon, authenticated;
revoke execute on function public.admin_challenge_detail(uuid) from public, anon, authenticated;
revoke execute on function public.admin_list_participants(
  uuid, text, public.enrollment_status, text, numeric, numeric, text, text, integer, integer
) from public, anon, authenticated;
revoke execute on function public.admin_participant_detail(uuid) from public, anon, authenticated;

grant execute on function public.admin_dashboard_overview() to authenticated;
grant execute on function public.admin_list_challenges(
  text, public.challenge_status, text, text, integer, integer
) to authenticated;
grant execute on function public.admin_challenge_detail(uuid) to authenticated;
grant execute on function public.admin_list_participants(
  uuid, text, public.enrollment_status, text, numeric, numeric, text, text, integer, integer
) to authenticated;
grant execute on function public.admin_participant_detail(uuid) to authenticated;
