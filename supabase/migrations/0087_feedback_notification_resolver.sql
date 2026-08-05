-- Parte E - a runFeedbackRespondedAutomation precisa de um resolver de
-- audiencia (motor de 0041+0048, mesmo padrao de um resolver por tipo de
-- audiencia - ver automation_resolve_specific_users_audience para
-- conquistas). Nao reaproveita o resolver de conquistas porque aquele
-- gate na preferencia 'achievement_notifications', que nao tem relacao com
-- resposta de feedback - usar aquele seria silenciar avisos de feedback
-- para quem so desligou notificacao de conquista. A preferencia correta
-- ja existe (important_updates_notifications, ver
-- notification-preferences.schemas.ts), so faltava o resolver.
create function public.automation_resolve_important_update_audience(p_user_ids uuid[])
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
      and coalesce((up.notifications ->> 'important_updates_notifications')::boolean, true);
end;
$$;

revoke all on function public.automation_resolve_important_update_audience(uuid[]) from public, anon, authenticated;
grant execute on function public.automation_resolve_important_update_audience(uuid[]) to service_role;
