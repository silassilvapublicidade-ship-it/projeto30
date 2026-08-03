-- Modulo F, Rodada F2: resolvers de publico das 6 automacoes.
--
-- Cada funcao aqui responde apenas "quem se qualifica agora" para uma regra
-- de negocio especifica - nenhuma delas envia nada. O envio de verdade
-- continua 100% dentro de dispatchCampaignToAudience
-- (notification-dispatch.service.ts), a mesma engine usada pelo compositor
-- admin. "Comeca amanha/hoje" e "termina em 3 dias" usam challenges.
-- start_date/end_date (data fixa do ciclo), nao personal_start_date da
-- inscricao - e a data do CICLO que justifica o aviso ("O Desafio X comeca
-- amanha"), independente de quando cada participante se inscreveu.
-- Timezone de referencia para essas comparacoes de data de ciclo (nao por
-- usuario) e America/Sao_Paulo, o mesmo fallback ja documentado em
-- journey_get_local_date - nunca UTC puro, que erraria o dia perto da
-- meia-noite para o publico majoritariamente brasileiro deste produto.

create or replace function public.automation_resolve_daily_reminder_audience()
returns table (local_date date, push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select distinct
      loc.local_date,
      exists (
        select 1 from public.push_subscriptions ps
        where ps.user_id = u.id and ps.revoked_at is null
      ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
      u.id
    from public.challenge_enrollments ce
    join public.users u on u.id = ce.user_id
    join public.challenges c on c.id = ce.challenge_id
    join public.user_preferences up on up.user_id = u.id
    cross join lateral (select public.journey_get_local_date(u.timezone) as local_date) loc
    where ce.status = 'active'
      and c.status = 'active'
      and c.deleted_at is null
      and u.status = 'active'
      and u.deleted_at is null
      and coalesce((up.notifications ->> 'daily_reminder_enabled')::boolean, false)
      and extract(hour from timezone(coalesce(nullif(u.timezone, ''), 'America/Sao_Paulo'), now())) between 7 and 21
      and not exists (
        select 1 from public.daily_logs dl
        where dl.enrollment_id = ce.id
          and dl.log_date = loc.local_date
          and dl.status = 'finalized'
      );
end;
$$;

revoke all on function public.automation_resolve_daily_reminder_audience() from public, anon, authenticated;
grant execute on function public.automation_resolve_daily_reminder_audience() to service_role;

create or replace function public.automation_resolve_challenge_date_audience(
  p_use_start_date boolean,
  p_days_offset integer
)
returns table (challenge_id uuid, challenge_name text, push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_target_date date := (timezone('America/Sao_Paulo', now())::date) + p_days_offset;
begin
  return query
    select distinct
      c.id,
      c.name,
      exists (
        select 1 from public.push_subscriptions ps
        where ps.user_id = u.id and ps.revoked_at is null
      ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
      u.id
    from public.challenges c
    join public.challenge_enrollments ce on ce.challenge_id = c.id
    join public.users u on u.id = ce.user_id
    left join public.user_preferences up on up.user_id = u.id
    where c.deleted_at is null
      and c.status = 'active'
      and ce.status = 'active'
      and u.status = 'active'
      and u.deleted_at is null
      and coalesce((up.notifications ->> 'challenge_start_notifications')::boolean, true)
      and (
        (p_use_start_date and c.start_date = v_target_date)
        or (not p_use_start_date and c.end_date = v_target_date)
      );
end;
$$;

revoke all on function public.automation_resolve_challenge_date_audience(boolean, integer) from public, anon, authenticated;
grant execute on function public.automation_resolve_challenge_date_audience(boolean, integer) to service_role;

create or replace function public.automation_resolve_inactive_users_audience(p_inactive_days integer default 3)
returns table (push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
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
    cross join lateral (select public.journey_get_local_date(u.timezone) as local_date) loc
    where ce.status = 'active'
      and u.status = 'active'
      and u.deleted_at is null
      and coalesce((up.notifications ->> 'important_updates_notifications')::boolean, true)
      and not exists (
        select 1 from public.daily_logs dl
        where dl.enrollment_id = ce.id
          and dl.status = 'finalized'
          and dl.log_date > loc.local_date - p_inactive_days
      );
end;
$$;

revoke all on function public.automation_resolve_inactive_users_audience(integer) from public, anon, authenticated;
grant execute on function public.automation_resolve_inactive_users_audience(integer) to service_role;

create or replace function public.automation_resolve_new_tip_subscribers_audience()
returns table (push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select
      exists (
        select 1 from public.push_subscriptions ps
        where ps.user_id = u.id and ps.revoked_at is null
      ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
      u.id
    from public.users u
    left join public.user_preferences up on up.user_id = u.id
    where u.status = 'active'
      and u.deleted_at is null
      and coalesce((up.notifications ->> 'new_tip_notifications')::boolean, true);
end;
$$;

revoke all on function public.automation_resolve_new_tip_subscribers_audience() from public, anon, authenticated;
grant execute on function public.automation_resolve_new_tip_subscribers_audience() to service_role;

-- Usada pela automacao de conquista desbloqueada - filtra por
-- achievement_notifications especificamente (nao e uma funcao generica de
-- "qualquer lista de usuarios", so aceita array para o caso futuro de um
-- desbloqueio compartilhado entre mais de um usuario no mesmo evento).
create or replace function public.automation_resolve_specific_users_audience(p_user_ids uuid[])
returns table (push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select
      exists (
        select 1 from public.push_subscriptions ps
        where ps.user_id = u.id and ps.revoked_at is null
      ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
      u.id
    from public.users u
    left join public.user_preferences up on up.user_id = u.id
    where u.id = any(p_user_ids)
      and u.status = 'active'
      and u.deleted_at is null
      and coalesce((up.notifications ->> 'achievement_notifications')::boolean, true);
end;
$$;

revoke all on function public.automation_resolve_specific_users_audience(uuid[]) from public, anon, authenticated;
grant execute on function public.automation_resolve_specific_users_audience(uuid[]) to service_role;
