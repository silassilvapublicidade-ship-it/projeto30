-- Architecture for forced password change on first login. The round asks
-- explicitly to prepare this column now without applying the enforcement
-- logic yet - no middleware/gate reads this column in this migration; it's
-- a flag future work can act on (e.g. a check in requireAuthUser redirecting
-- to a "set a new password" screen when true).
alter table public.users
  add column if not exists must_change_password boolean not null default false;

-- Lets an admin enroll a specific (typically freshly created) user into a
-- specific published/active challenge. join_specific_challenge() can't be
-- reused for this - it always enrolls auth.uid(), i.e. whoever is calling
-- it, never an arbitrary target user. Mirrors the same validation shape
-- (challenge must be joinable, personal_start_date from the *target* user's
-- own timezone via journey_get_local_date, idempotent if already enrolled)
-- but gated by admin_require_admin() instead of requiring the caller to be
-- the enrollee.
create or replace function public.admin_enroll_user_in_challenge(
  p_user_id uuid,
  p_challenge_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_timezone text;
  v_challenge_status public.challenge_status;
  v_existing_enrollment_id uuid;
  v_local_date date;
  v_new_enrollment_id uuid;
begin
  perform public.admin_require_admin();

  select timezone
  into v_profile_timezone
  from public.users
  where id = p_user_id
    and status = 'active'
    and deleted_at is null
  for update;

  if v_profile_timezone is null then
    raise exception 'Usuario nao encontrado ou inativo.'
      using errcode = 'P0002';
  end if;

  select status
  into v_challenge_status
  from public.challenges
  where id = p_challenge_id
    and deleted_at is null;

  if v_challenge_status is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  if v_challenge_status <> 'active' then
    raise exception 'Apenas desafios publicados podem receber inscricao automatica.'
      using errcode = 'P0003';
  end if;

  select id
  into v_existing_enrollment_id
  from public.challenge_enrollments
  where user_id = p_user_id
    and challenge_id = p_challenge_id
    and status in ('active', 'paused')
  order by joined_at desc
  limit 1;

  if v_existing_enrollment_id is not null then
    -- Idempotent, matching join_specific_challenge's own behavior.
    return v_existing_enrollment_id;
  end if;

  v_local_date := public.journey_get_local_date(v_profile_timezone);

  insert into public.challenge_enrollments (user_id, challenge_id, personal_start_date)
  values (p_user_id, p_challenge_id, v_local_date)
  returning id into v_new_enrollment_id;

  return v_new_enrollment_id;
end;
$$;

revoke all on function public.admin_enroll_user_in_challenge(uuid, uuid) from public, anon;
grant execute on function public.admin_enroll_user_in_challenge(uuid, uuid) to authenticated;
