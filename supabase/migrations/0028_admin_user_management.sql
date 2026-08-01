-- Module B: full admin user management (listing/filters, detail aggregate,
-- role changes, status changes, a deletion guard). All security definer,
-- gated by admin_require_admin(), auditing every mutation into
-- admin_audit_logs - same shape as 0022's admin_delete_test_challenge and
-- 0026's admin_enroll_user_in_challenge.
--
-- "last_sign_in_at" (auth.users) is deliberately NOT included here: there is
-- no established pattern in this project yet for a security definer
-- function reading the auth schema, and the brief itself treats this field
-- as optional ("se disponivel de forma confiavel"). Left as a follow-up
-- rather than risking the whole listing RPC on an unverified cross-schema
-- permission.

create or replace function public.admin_list_users(
  p_search text default null,
  p_role public.user_role default null,
  p_status public.user_status default null,
  p_profile_complete boolean default null,
  p_must_change_password boolean default null,
  p_has_active_challenge boolean default null,
  p_sort_by text default 'created_at',
  p_sort_dir text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  name text,
  display_name text,
  avatar_url text,
  role public.user_role,
  status public.user_status,
  onboarding_completed boolean,
  must_change_password boolean,
  active_challenge_count bigint,
  created_at timestamptz,
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

  if v_sort_by not in ('created_at', 'name', 'status') then
    v_sort_by := 'created_at';
  end if;

  if v_sort_dir not in ('asc', 'desc') then
    v_sort_dir := 'desc';
  end if;

  return query execute format(
    $q$
      select
        base.id,
        base.email,
        base.name,
        base.display_name,
        base.avatar_url,
        base.role,
        base.status,
        base.onboarding_completed,
        base.must_change_password,
        base.active_challenge_count,
        base.created_at,
        count(*) over() as total_count
      from (
        select
          u.id,
          u.email::text as email,
          u.name,
          u.display_name,
          u.avatar_url,
          u.role,
          u.status,
          u.onboarding_completed,
          u.must_change_password,
          u.created_at,
          coalesce(enrollment_stats.active_count, 0) as active_challenge_count
        from public.users u
        left join lateral (
          select count(*) as active_count
          from public.challenge_enrollments ce
          where ce.user_id = u.id
            and ce.status in ('active', 'paused')
        ) enrollment_stats on true
        where u.deleted_at is null
      ) base
      where ($1 is null or base.role = $1)
        and ($2 is null or base.status = $2)
        and (
          $3 is null
          or base.name ilike '%%' || $3 || '%%'
          or base.display_name ilike '%%' || $3 || '%%'
          or base.email ilike '%%' || $3 || '%%'
        )
        and ($4 is null or base.onboarding_completed = $4)
        and ($5 is null or base.must_change_password = $5)
        and (
          $6 is null
          or ($6 is true and base.active_challenge_count > 0)
          or ($6 is false and base.active_challenge_count = 0)
        )
      order by %I %s nulls last, base.id asc
      limit $7
      offset $8
    $q$,
    v_sort_by,
    v_sort_dir
  )
  using
    p_role,
    p_status,
    nullif(trim(coalesce(p_search, '')), ''),
    p_profile_complete,
    p_must_change_password,
    p_has_active_challenge,
    v_limit,
    v_offset;
end;
$$;

create or replace function public.admin_user_detail(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_enrollments jsonb;
  v_achievements jsonb;
  v_audit_logs jsonb;
begin
  perform public.admin_require_admin();

  select
    u.id, u.email::text as email, u.name, u.display_name, u.avatar_url, u.city,
    u.timezone, u.role, u.status, u.onboarding_completed, u.must_change_password,
    u.created_at, u.updated_at
  into v_profile
  from public.users u
  where u.id = p_user_id
    and u.deleted_at is null;

  if v_profile.id is null then
    raise exception 'Usuario nao encontrado.'
      using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(row_to_json(enrollment) order by enrollment.joined_at desc), '[]'::jsonb)
  into v_enrollments
  from (
    select
      ce.id as enrollment_id,
      ce.challenge_id,
      c.name as challenge_name,
      ce.status,
      ce.joined_at,
      ce.completed_at,
      ce.personal_start_date,
      ce.current_day,
      ce.points_total,
      ce.streak_current,
      ce.streak_best,
      ce.completion_percent
    from public.challenge_enrollments ce
    join public.challenges c on c.id = ce.challenge_id
    where ce.user_id = p_user_id
  ) enrollment;

  select coalesce(jsonb_agg(row_to_json(achievement) order by achievement.unlocked_at desc), '[]'::jsonb)
  into v_achievements
  from (
    select
      ua.id as user_achievement_id,
      a.id as achievement_id,
      a.name,
      a.category,
      a.rarity,
      ua.unlocked_at
    from public.user_achievements ua
    join public.achievements a on a.id = ua.achievement_id
    where ua.user_id = p_user_id
  ) achievement;

  select coalesce(jsonb_agg(row_to_json(log) order by log.created_at desc), '[]'::jsonb)
  into v_audit_logs
  from (
    select action, created_at, admin_user_id
    from public.admin_audit_logs
    where entity_type = 'user'
      and entity_id = p_user_id
    order by created_at desc
    limit 10
  ) log;

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'enrollments', v_enrollments,
    'achievements', v_achievements,
    'recent_audit_logs', v_audit_logs
  );
end;
$$;

-- Raises when the target is the sole active super_admin, so a single
-- misclick (or a compromised admin session) can never leave the platform
-- with zero usable super_admin accounts. "Sole" is evaluated over
-- active + non-deleted super_admins only - a suspended/inactive/deleted one
-- doesn't count as the safety net anyway.
create or replace function public.admin_assert_not_sole_super_admin(
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_role public.user_role;
  v_other_active_super_admins integer;
begin
  select role into v_target_role
  from public.users
  where id = p_user_id
    and deleted_at is null;

  if v_target_role is distinct from 'super_admin' then
    return;
  end if;

  select count(*)
  into v_other_active_super_admins
  from public.users
  where role = 'super_admin'
    and status = 'active'
    and deleted_at is null
    and id <> p_user_id;

  if v_other_active_super_admins = 0 then
    raise exception 'Esta e a unica conta super_admin ativa - a acao foi bloqueada.'
      using errcode = 'P0007';
  end if;
end;
$$;

create or replace function public.admin_update_user_status(
  p_user_id uuid,
  p_new_status public.user_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_old_status public.user_status;
begin
  perform public.admin_require_admin();

  if p_user_id = v_admin_id and p_new_status <> 'active' then
    raise exception 'Voce nao pode bloquear ou desativar a propria conta.'
      using errcode = 'P0007';
  end if;

  if p_new_status <> 'active' then
    perform public.admin_assert_not_sole_super_admin(p_user_id);
  end if;

  select status into v_old_status
  from public.users
  where id = p_user_id
    and deleted_at is null
  for update;

  if v_old_status is null then
    raise exception 'Usuario nao encontrado.'
      using errcode = 'P0002';
  end if;

  update public.users
  set status = p_new_status, updated_at = now()
  where id = p_user_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    v_admin_id, 'admin_update_user_status', 'user', p_user_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status)
  );
end;
$$;

create or replace function public.admin_update_user_role(
  p_user_id uuid,
  p_new_role public.user_role
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_acting_role public.user_role;
  v_old_role public.user_role;
begin
  v_acting_role := public.admin_require_admin();

  if p_user_id = v_admin_id then
    raise exception 'Voce nao pode alterar o proprio papel.'
      using errcode = 'P0007';
  end if;

  select role into v_old_role
  from public.users
  where id = p_user_id
    and deleted_at is null
  for update;

  if v_old_role is null then
    raise exception 'Usuario nao encontrado.'
      using errcode = 'P0002';
  end if;

  -- Only super_admin can grant or revoke admin/super_admin - a regular
  -- admin can freely move someone between 'user' and 'moderator' only.
  if
    v_acting_role <> 'super_admin'
    and (p_new_role in ('admin', 'super_admin') or v_old_role in ('admin', 'super_admin'))
  then
    raise exception 'Apenas super_admin pode conceder ou revogar papeis administrativos.'
      using errcode = '42501';
  end if;

  if p_new_role <> 'super_admin' then
    perform public.admin_assert_not_sole_super_admin(p_user_id);
  end if;

  update public.users
  set role = p_new_role, updated_at = now()
  where id = p_user_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    v_admin_id, 'admin_update_user_role', 'user', p_user_id,
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_new_role)
  );
end;
$$;

create or replace function public.admin_update_user_profile(
  p_user_id uuid,
  p_name text,
  p_display_name text,
  p_city text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  perform public.admin_require_admin();

  update public.users
  set
    name = nullif(trim(p_name), ''),
    display_name = nullif(trim(p_display_name), ''),
    city = nullif(trim(p_city), ''),
    updated_at = now()
  where id = p_user_id
    and deleted_at is null;

  if not found then
    raise exception 'Usuario nao encontrado.'
      using errcode = 'P0002';
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id
  )
  values (v_admin_id, 'admin_update_user_profile', 'user', p_user_id);
end;
$$;

-- Called before the Server Action's auth.admin.deleteUser() (which the DB
-- cannot see or gate itself, since it's a call to the Auth Admin API, not a
-- SQL statement) - authoritative server-side guard so the self-deletion and
-- sole-super_admin protections can never be bypassed by skipping the
-- application-level checks.
create or replace function public.admin_assert_user_deletable(
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  perform public.admin_require_admin();

  if p_user_id = v_admin_id then
    raise exception 'Voce nao pode excluir a propria conta.'
      using errcode = 'P0007';
  end if;

  perform public.admin_assert_not_sole_super_admin(p_user_id);
end;
$$;

revoke all on function public.admin_list_users(
  text, public.user_role, public.user_status, boolean, boolean, boolean, text, text, integer, integer
) from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
revoke all on function public.admin_assert_not_sole_super_admin(uuid) from public, anon;
revoke all on function public.admin_update_user_status(uuid, public.user_status) from public, anon;
revoke all on function public.admin_update_user_role(uuid, public.user_role) from public, anon;
revoke all on function public.admin_update_user_profile(uuid, text, text, text) from public, anon;
revoke all on function public.admin_assert_user_deletable(uuid) from public, anon;

grant execute on function public.admin_list_users(
  text, public.user_role, public.user_status, boolean, boolean, boolean, text, text, integer, integer
) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_update_user_status(uuid, public.user_status) to authenticated;
grant execute on function public.admin_update_user_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_update_user_profile(uuid, text, text, text) to authenticated;
grant execute on function public.admin_assert_user_deletable(uuid) to authenticated;
-- admin_assert_not_sole_super_admin is an internal helper called by the
-- functions above (which run as their definer regardless), not meant to be
-- invoked directly by application code.
