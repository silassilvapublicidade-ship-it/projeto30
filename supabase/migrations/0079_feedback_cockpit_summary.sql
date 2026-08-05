-- Resumo enxuto para o Cockpit (Parte D) - só contagens, nunca conteúdo.
-- Critério de alerta explícito do usuário: "uma única opinião negativa
-- nunca deve classificar o sistema como degradado" - por isso este resumo
-- NUNCA participa de admin_get_system_health_overview() nem de
-- buildHealthAlerts(); o Cockpit decide o limiar de exibição no código
-- (>= 3 negativas recentes, >= 1 urgente) separado do status geral do
-- sistema.
create or replace function public.admin_feedback_cockpit_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_new_count integer;
  v_urgent_count integer;
  v_reviewing_count integer;
  v_recent_negative_count integer;
begin
  perform public.admin_require_admin();

  select count(*) filter (where status = 'new'),
         count(*) filter (where priority = 'urgent' and status not in ('resolved', 'closed')),
         count(*) filter (where status = 'reviewing')
  into v_new_count, v_urgent_count, v_reviewing_count
  from public.user_feedback;

  select count(*) into v_recent_negative_count
  from public.user_feedback
  where sentiment = 'negative' and created_at >= now() - interval '7 days';

  return jsonb_build_object(
    'newCount', coalesce(v_new_count, 0),
    'urgentCount', coalesce(v_urgent_count, 0),
    'reviewingCount', coalesce(v_reviewing_count, 0),
    'recentNegativeRatings', coalesce(v_recent_negative_count, 0)
  );
end;
$$;

revoke all on function public.admin_feedback_cockpit_summary() from public, anon;
grant execute on function public.admin_feedback_cockpit_summary() to authenticated;
