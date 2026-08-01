-- Module D: funnel, retention, extended habits, Dicas analytics, achievement
-- analytics and user analytics. All security definer + admin_require_admin,
-- same pattern as 0006/0028/0030. Raw counts only - conversion/percentage
-- math happens in TypeScript (admin-metrics.core.ts) so it stays unit
-- testable without a database.
--
-- "Nao inferir visitas retroativas inexistentes" (brief): every function
-- that depends on analytics_events also returns the earliest event it found
-- (or null), so the UI can tell "zero conversions" apart from "no
-- instrumentation data before this date" instead of fabricating a 0% rate
-- for challenges/tips that predate this migration.

-- IMPORTANT: admin_challenge_funnel ALREADY EXISTED (0017) and is already
-- consumed by /admin/desafios/[challengeId] (getAdminChallengeFunnel reads
-- `funnel.stages`, an array of {key,label,value}). This redefinition is
-- purely ADDITIVE: the `stages` array is reproduced byte-for-byte with the
-- exact same 8 entries and the exact same event-based computation as 0017
-- (never touched), so the existing page keeps working unchanged. Everything
-- else below `stages` in the returned object is new - the brief's extra
-- funnel granularity (day1/day3, real enrollment counts instead of
-- event-based ones, pause/resume) that 0017 didn't have.
create or replace function public.admin_challenge_funnel(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge record;
  v_stages jsonb;
  v_detail_views integer := 0;
  v_join_clicks integer := 0;
  v_joined integer := 0;
  v_first_habit integer := 0;
  v_day_7 integer := 0;
  v_halfway_stage integer := 0;
  v_completed_stage integer := 0;
  v_abandoned_stage integer := 0;
  v_earliest_event timestamptz;
  v_global_catalog_views bigint;
  v_joins_completed bigint;
  v_day1 bigint;
  v_day3 bigint;
  v_halfway_day integer;
  v_halfway_completed bigint;
  v_completed_real bigint;
  v_abandoned_real bigint;
  v_currently_paused bigint;
  v_pause_events bigint;
  v_resume_events bigint;
begin
  perform public.admin_require_admin();

  select id, name, duration_days into v_challenge
  from public.challenges
  where id = p_challenge_id and deleted_at is null;

  if v_challenge.id is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  -- Unchanged from 0017.
  select
    count(*) filter (where event_name = 'challenge_detail_viewed'),
    count(*) filter (where event_name = 'challenge_join_clicked'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_joined'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_first_habit_completed'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_day_7_reached'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_halfway_reached'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_completed'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_abandoned')
  into
    v_detail_views, v_join_clicks, v_joined, v_first_habit,
    v_day_7, v_halfway_stage, v_completed_stage, v_abandoned_stage
  from public.analytics_events
  where challenge_id = p_challenge_id;

  v_stages := jsonb_build_array(
    jsonb_build_object('key', 'detail_viewed', 'label', 'Visualizou o detalhe', 'value', v_detail_views),
    jsonb_build_object('key', 'join_clicked', 'label', 'Clicou em participar', 'value', v_join_clicks),
    jsonb_build_object('key', 'joined', 'label', 'Inscricao concluida', 'value', v_joined),
    jsonb_build_object('key', 'first_habit', 'label', 'Primeiro habito', 'value', v_first_habit),
    jsonb_build_object('key', 'day_7', 'label', 'Chegou ao dia 7', 'value', v_day_7),
    jsonb_build_object('key', 'halfway', 'label', 'Chegou na metade', 'value', v_halfway_stage),
    jsonb_build_object('key', 'completed', 'label', 'Concluiu o desafio', 'value', v_completed_stage),
    jsonb_build_object('key', 'abandoned', 'label', 'Abandonou', 'value', v_abandoned_stage)
  );

  -- New in Module D, everything below real data where possible (accurate
  -- even for challenges that predate instrumentation), analytics_events
  -- only where there's no real-table equivalent (views/clicks).
  v_halfway_day := greatest(1, v_challenge.duration_days / 2);

  select min(occurred_at) into v_earliest_event
  from public.analytics_events
  where challenge_id = p_challenge_id;

  select count(*) into v_global_catalog_views
  from public.analytics_events
  where event_name = 'challenge_catalog_viewed';

  select count(*) into v_joins_completed
  from public.challenge_enrollments
  where challenge_id = p_challenge_id;

  select count(*) into v_day1
  from public.daily_logs dl
  join public.challenge_days cd on cd.id = dl.challenge_day_id
  where dl.challenge_id = p_challenge_id and dl.status = 'finalized' and cd.day_number = 1;

  select count(*) into v_day3
  from public.daily_logs dl
  join public.challenge_days cd on cd.id = dl.challenge_day_id
  where dl.challenge_id = p_challenge_id and dl.status = 'finalized' and cd.day_number = 3;

  select count(*) into v_halfway_completed
  from public.daily_logs dl
  join public.challenge_days cd on cd.id = dl.challenge_day_id
  where dl.challenge_id = p_challenge_id and dl.status = 'finalized' and cd.day_number = v_halfway_day;

  select count(*) into v_completed_real
  from public.challenge_enrollments
  where challenge_id = p_challenge_id and status = 'completed';

  select count(*) into v_abandoned_real
  from public.challenge_enrollments
  where challenge_id = p_challenge_id and status = 'abandoned';

  select count(*) into v_currently_paused
  from public.challenge_enrollments
  where challenge_id = p_challenge_id and status = 'paused';

  select count(*) into v_pause_events
  from public.analytics_events
  where event_name in ('challenge_paused', 'enrollment_paused') and challenge_id = p_challenge_id;

  select count(*) into v_resume_events
  from public.analytics_events
  where event_name in ('challenge_resumed', 'enrollment_resumed') and challenge_id = p_challenge_id;

  return jsonb_build_object(
    'stages', v_stages,
    'challenge_id', v_challenge.id,
    'challenge_name', v_challenge.name,
    'earliest_event_at', v_earliest_event,
    'global_catalog_views', v_global_catalog_views,
    'joins_completed_real', v_joins_completed,
    'day1_completed', v_day1,
    'day3_completed', v_day3,
    'halfway_day', v_halfway_day,
    'halfway_completed_real', v_halfway_completed,
    'completed_real', v_completed_real,
    'abandoned_real', v_abandoned_real,
    'currently_paused', v_currently_paused,
    'pause_events', v_pause_events,
    'resume_events', v_resume_events
  );
end;
$$;

-- PL/pgSQL has no nested function definitions, so the per-day retention
-- calculation is its own top-level helper (same pattern as
-- admin_require_admin()) that admin_challenge_retention calls 4 times.
-- "Eligible" = enough calendar time has passed (via journey_calculate_day,
-- pause-offset aware, same function the journey engine itself uses) for day
-- N to have occurred - never inferred for enrollments that haven't reached
-- that day yet.
create or replace function public.admin_retention_for_day(
  p_challenge_id uuid,
  p_day integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_eligible bigint;
  v_retained bigint;
begin
  -- Defense in depth, same reasoning as every other admin_* function: the
  -- real gate is this check, not the grant below (which only narrows who
  -- can even attempt the call).
  perform public.admin_require_admin();

  select count(*) into v_eligible
  from public.challenge_enrollments ce
  where ce.challenge_id = p_challenge_id
    and public.journey_calculate_day(
      ce.personal_start_date, current_date, ce.paused_days_offset
    ) >= p_day;

  select count(*) into v_retained
  from public.challenge_enrollments ce
  where ce.challenge_id = p_challenge_id
    and public.journey_calculate_day(
      ce.personal_start_date, current_date, ce.paused_days_offset
    ) >= p_day
    and exists (
      select 1
      from public.daily_logs dl
      join public.challenge_days cd on cd.id = dl.challenge_day_id
      where dl.enrollment_id = ce.id
        and dl.status = 'finalized'
        and cd.day_number = p_day
    );

  return jsonb_build_object('day', p_day, 'eligible', v_eligible, 'retained', v_retained);
end;
$$;

-- admin_challenge_detail (0006): only habit_adherence changes - adds
-- `required` (bool_or across the days this habit appears on, since
-- challenge_day_habits.required is set per day-habit pairing and could in
-- principle differ by day) so the UI can show "obrigatorio vs opcional"
-- without a second round trip. adherence_percent's own formula is
-- byte-for-byte unchanged - it's an existing, already-validated frequency
-- calculation, not something this module is allowed to touch.
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
      bool_or(cdh.required) as required,
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

create or replace function public.admin_tips_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_earliest_event timestamptz;
  v_total_views bigint;
  v_total_opens bigint;
  v_total_downloads bigint;
  v_cards jsonb;
  v_categories jsonb;
begin
  perform public.admin_require_admin();

  select min(occurred_at) into v_earliest_event
  from public.analytics_events
  where event_name in ('tip_card_viewed', 'tip_card_opened', 'tip_card_downloaded');

  select
    count(*) filter (where event_name = 'tip_card_viewed'),
    count(*) filter (where event_name = 'tip_card_opened'),
    count(*) filter (where event_name = 'tip_card_downloaded')
  into v_total_views, v_total_opens, v_total_downloads
  from public.analytics_events
  where event_name in ('tip_card_viewed', 'tip_card_opened', 'tip_card_downloaded');

  select coalesce(jsonb_agg(row_to_json(card) order by card.views desc), '[]'::jsonb)
  into v_cards
  from (
    select
      ci.id as content_item_id,
      ci.title,
      ci.category,
      (select count(*) from public.analytics_events ae where ae.content_item_id = ci.id and ae.event_name = 'tip_card_viewed') as views,
      (select count(*) from public.analytics_events ae where ae.content_item_id = ci.id and ae.event_name = 'tip_card_opened') as opens,
      (select count(*) from public.analytics_events ae where ae.content_item_id = ci.id and ae.event_name = 'tip_card_downloaded') as downloads
    from public.content_items ci
    where ci.content_type = 'tip_card'
      and ci.status = 'published'
    limit 200
  ) card;

  select coalesce(jsonb_agg(row_to_json(cat) order by cat.views desc), '[]'::jsonb)
  into v_categories
  from (
    select
      coalesce(ci.category, 'sem-categoria') as category,
      count(ae.id) as views
    from public.content_items ci
    left join public.analytics_events ae
      on ae.content_item_id = ci.id and ae.event_name = 'tip_card_viewed'
    where ci.content_type = 'tip_card' and ci.status = 'published'
    group by coalesce(ci.category, 'sem-categoria')
  ) cat;

  return jsonb_build_object(
    'earliest_event_at', v_earliest_event,
    'total_views', v_total_views,
    'total_opens', v_total_opens,
    'total_downloads', v_total_downloads,
    'cards', v_cards,
    'categories', v_categories
  );
end;
$$;

-- Per-achievement share/download numbers come from share_cards directly
-- (achievement_id, downloaded_at, shared_at all already exist there - see
-- 0014), NOT from analytics_events: share_achievement_started/completed
-- (0012) are recorded WITHOUT an achievement_id or challenge_id (only
-- {format} in metadata - confirmed by reading
-- app/api/achievements/[userAchievementId]/share-card/route.ts), so they
-- cannot be attributed to one specific achievement. Global totals for those
-- two event names are returned separately, clearly not broken down per
-- achievement.
create or replace function public.admin_achievements_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_achievements jsonb;
  v_global_share_started bigint;
  v_global_share_completed bigint;
begin
  perform public.admin_require_admin();

  select
    count(*) filter (where event_name = 'share_achievement_started'),
    count(*) filter (where event_name = 'share_achievement_completed')
  into v_global_share_started, v_global_share_completed
  from public.analytics_events
  where event_name in ('share_achievement_started', 'share_achievement_completed');

  select coalesce(jsonb_agg(row_to_json(a) order by a.unlocked_count asc), '[]'::jsonb)
  into v_achievements
  from (
    select
      ach.id as achievement_id,
      ach.name,
      ach.challenge_id,
      c.name as challenge_name,
      ach.rarity,
      ach.active,
      (select count(distinct ua.user_id) from public.user_achievements ua where ua.achievement_id = ach.id) as unlocked_count,
      (select count(*) from public.challenge_enrollments ce2 where ce2.challenge_id = ach.challenge_id) as challenge_enrollment_count,
      (select count(*) from public.share_cards sc where sc.achievement_id = ach.id and sc.card_type = 'achievement') as share_generated_count,
      (select count(*) from public.share_cards sc where sc.achievement_id = ach.id and sc.card_type = 'achievement' and sc.shared_at is not null) as share_completed_count,
      (select count(*) from public.share_cards sc where sc.achievement_id = ach.id and sc.card_type = 'achievement' and sc.downloaded_at is not null) as download_count,
      (
        select count(*)
        from public.share_cards sc
        join public.share_templates st on st.id = sc.template_id
        where sc.achievement_id = ach.id and sc.card_type = 'achievement' and st.slug = 'achievement_story'
      ) as story_count,
      (
        select count(*)
        from public.share_cards sc
        join public.share_templates st on st.id = sc.template_id
        where sc.achievement_id = ach.id and sc.card_type = 'achievement' and st.slug = 'achievement_feed'
      ) as feed_count
    from public.achievements ach
    join public.challenges c on c.id = ach.challenge_id
  ) a;

  return jsonb_build_object(
    'achievements', v_achievements,
    'global_share_started', v_global_share_started,
    'global_share_completed', v_global_share_completed
  );
end;
$$;

create or replace function public.admin_users_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total bigint;
  v_active bigint;
  v_suspended bigint;
  v_inactive_status bigint;
  v_onboarding_incomplete bigint;
  v_must_change_password bigint;
  v_with_active_challenge bigint;
  v_without_active_challenge bigint;
begin
  perform public.admin_require_admin();

  select count(*) into v_total from public.users where deleted_at is null;

  select count(*) into v_active from public.users where deleted_at is null and status = 'active';
  select count(*) into v_suspended from public.users where deleted_at is null and status = 'suspended';
  select count(*) into v_inactive_status from public.users where deleted_at is null and status = 'inactive';
  select count(*) into v_onboarding_incomplete
    from public.users where deleted_at is null and onboarding_completed = false;
  select count(*) into v_must_change_password
    from public.users where deleted_at is null and must_change_password = true;

  select count(*) into v_with_active_challenge
  from public.users u
  where u.deleted_at is null
    and exists (
      select 1 from public.challenge_enrollments ce
      where ce.user_id = u.id and ce.status in ('active', 'paused')
    );

  v_without_active_challenge := greatest(v_total - v_with_active_challenge, 0);

  return jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'suspended', v_suspended,
    'inactive_status', v_inactive_status,
    'onboarding_incomplete', v_onboarding_incomplete,
    'must_change_password_pending', v_must_change_password,
    'with_active_challenge', v_with_active_challenge,
    'without_active_challenge', v_without_active_challenge
  );
end;
$$;

create or replace function public.admin_challenge_retention(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge record;
  v_halfway_day integer;
begin
  perform public.admin_require_admin();

  select id, duration_days into v_challenge
  from public.challenges
  where id = p_challenge_id and deleted_at is null;

  if v_challenge.id is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  v_halfway_day := greatest(1, v_challenge.duration_days / 2);

  return jsonb_build_object(
    'challenge_id', v_challenge.id,
    'd1', public.admin_retention_for_day(p_challenge_id, 1),
    'd3', public.admin_retention_for_day(p_challenge_id, 3),
    'd7', public.admin_retention_for_day(p_challenge_id, 7),
    'halfway', public.admin_retention_for_day(p_challenge_id, v_halfway_day)
  );
end;
$$;

revoke all on function public.admin_challenge_funnel(uuid) from public, anon;
revoke all on function public.admin_retention_for_day(uuid, integer) from public, anon;
revoke all on function public.admin_challenge_retention(uuid) from public, anon;
revoke all on function public.admin_tips_analytics() from public, anon;
revoke all on function public.admin_achievements_analytics() from public, anon;
revoke all on function public.admin_users_analytics() from public, anon;

grant execute on function public.admin_challenge_funnel(uuid) to authenticated;
grant execute on function public.admin_retention_for_day(uuid, integer) to authenticated;
grant execute on function public.admin_challenge_retention(uuid) to authenticated;
grant execute on function public.admin_tips_analytics() to authenticated;
grant execute on function public.admin_achievements_analytics() to authenticated;
grant execute on function public.admin_users_analytics() to authenticated;
