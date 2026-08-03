-- Modulo G, Parte 9: o novo toggle "Campanhas do administrador"
-- (admin_campaign_notifications) precisa realmente ser respeitado antes de
-- qualquer envio (criterio de aceite explicito), nao so existir na UI.
-- resolve_notification_audience() e usada exclusivamente pelas campanhas
-- manuais do admin (as automacoes tem seus proprios resolvers dedicados em
-- 0048/0054, cada um com seu proprio gate de preferencia especifico) -
-- por isso o filtro entra aqui, em todo audience_type, sem tocar nos
-- resolvers de automacao. Mesma assinatura da funcao (create or replace
-- de verdade substitui, sem criar overload - ver 0055).
create or replace function public.resolve_notification_audience(
  p_audience_type text,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_min_streak integer default null,
  p_habit_keyword text default null
)
returns table (push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_audience_type = 'all_active_users' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.status = 'active' and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'specific_user' then
    if p_specific_user_id is null then
      return;
    end if;
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.id = p_specific_user_id and u.status = 'active' and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'challenge_participants' then
    if p_challenge_id is null then
      return;
    end if;
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.challenge_id = p_challenge_id and u.status = 'active' and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'active_enrollment' then
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active' and u.status = 'active' and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type in ('day_not_finalized', 'day_finalized') then
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      join public.challenges c on c.id = ce.challenge_id
      left join public.user_preferences up on up.user_id = u.id
      cross join lateral (select public.journey_get_local_date(u.timezone) as local_date) loc
      where ce.status = 'active'
        and c.status = 'active'
        and c.deleted_at is null
        and u.status = 'active'
        and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true)
        and (
          (
            p_audience_type = 'day_not_finalized'
            and not exists (
              select 1 from public.daily_logs dl
              where dl.enrollment_id = ce.id
                and dl.log_date = loc.local_date
                and dl.status = 'finalized'
            )
          )
          or (
            p_audience_type = 'day_finalized'
            and exists (
              select 1 from public.daily_logs dl
              where dl.enrollment_id = ce.id
                and dl.log_date = loc.local_date
                and dl.status = 'finalized'
            )
          )
        );

  elsif p_audience_type = 'push_enabled' then
    return query
      select true, u.id
      from public.users u
      join public.user_preferences up on up.user_id = u.id
      where u.status = 'active'
        and u.deleted_at is null
        and coalesce((up.notifications ->> 'push_enabled')::boolean, false)
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true)
        and exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        );

  elsif p_audience_type = 'push_disabled_internal_only' then
    return query
      select false, u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.status = 'active'
        and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true)
        and not (
          coalesce((up.notifications ->> 'push_enabled')::boolean, false)
          and exists (
            select 1 from public.push_subscriptions ps
            where ps.user_id = u.id and ps.revoked_at is null
          )
        );

  elsif p_audience_type = 'admins' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.role in ('admin', 'super_admin') and u.status = 'active' and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'super_admins' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.users u
      left join public.user_preferences up on up.user_id = u.id
      where u.role = 'super_admin' and u.status = 'active' and u.deleted_at is null
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'streak_above_threshold' then
    if p_min_streak is null then
      return;
    end if;
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and u.status = 'active'
        and u.deleted_at is null
        and ce.streak_current >= p_min_streak
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'streak_lost' then
    return query
      select
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and u.status = 'active'
        and u.deleted_at is null
        and ce.streak_current = 0
        and ce.streak_best > 0
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'day_all_habits_completed' then
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      join public.challenges c on c.id = ce.challenge_id
      join public.challenge_days cd on cd.challenge_id = c.id and cd.day_number = ce.current_day
      join public.daily_logs dl on dl.enrollment_id = ce.id and dl.challenge_day_id = cd.id
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and c.status = 'active'
        and c.deleted_at is null
        and u.status = 'active'
        and u.deleted_at is null
        and dl.completion_percent = 100
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true);

  elsif p_audience_type = 'habit_keyword_not_completed_today' then
    if p_habit_keyword is null or length(trim(p_habit_keyword)) = 0 then
      return;
    end if;
    return query
      select distinct
        exists (
          select 1 from public.push_subscriptions ps
          where ps.user_id = u.id and ps.revoked_at is null
        ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
        u.id
      from public.challenge_enrollments ce
      join public.users u on u.id = ce.user_id
      join public.challenges c on c.id = ce.challenge_id
      join public.challenge_days cd on cd.challenge_id = c.id and cd.day_number = ce.current_day
      join public.challenge_day_habits cdh on cdh.challenge_day_id = cd.id
      join public.habits h on h.id = cdh.habit_id and h.active
      left join public.user_preferences up on up.user_id = u.id
      where ce.status = 'active'
        and c.status = 'active'
        and c.deleted_at is null
        and u.status = 'active'
        and u.deleted_at is null
        and (h.title ilike '%' || p_habit_keyword || '%' or h.category ilike '%' || p_habit_keyword || '%')
        and public.habit_visible_on_day(h.visibility_config, cd.day_number, c.duration_days)
        and coalesce((up.notifications ->> 'admin_campaign_notifications')::boolean, true)
        and not exists (
          select 1
          from public.daily_logs dl
          join public.habit_logs hl on hl.daily_log_id = dl.id and hl.habit_id = h.id
          where dl.enrollment_id = ce.id
            and dl.challenge_day_id = cd.id
            and hl.status = 'completed'
        );

  else
    raise exception 'Publico invalido: %', p_audience_type using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.resolve_notification_audience(text, uuid, uuid, integer, text) from public, anon;
grant execute on function public.resolve_notification_audience(text, uuid, uuid, integer, text) to authenticated, service_role;

comment on function public.resolve_notification_audience(text, uuid, uuid, integer, text) is
  'Modulo G, Parte 9: todo audience_type agora tambem filtra por '
  'admin_campaign_notifications (default true para quem nunca configurou) - '
  'campanhas manuais do admin respeitam o opt-out, assim como toda '
  'automacao ja respeitava o seu proprio gate dedicado. Nenhum outro '
  'comportamento muda.';
