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
  computed_completion_percent numeric(5, 2) := 0;
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

  computed_completion_percent := case
    when applicable_habits = 0 then 100
    else round((completed_habits::numeric / applicable_habits::numeric) * 100, 2)
  end;

  update public.daily_logs
  set completion_percent = computed_completion_percent
  where id = target_daily_log_id;

  return jsonb_build_object(
    'applicable_habits', applicable_habits,
    'completed_habits', completed_habits,
    'completion_percent', computed_completion_percent
  );
end;
$$;

revoke execute on function public.journey_recalculate_daily_log(uuid)
  from public, anon, authenticated;
