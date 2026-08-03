-- Modulo G, Parte 12: resumo por periodo para o topo da listagem de
-- campanhas ("graficos por periodo", sem biblioteca de graficos - numeros
-- agregados, mesmo padrao AdminMetricCard ja usado no resto do admin).
-- Uma unica agregacao no banco (nunca N+1 de contagens separadas do
-- cliente - Parte 14).
create or replace function public.admin_notification_campaign_period_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_since timestamptz := now() - (greatest(1, coalesce(p_days, 30)) || ' days')::interval;
begin
  perform public.admin_require_admin();

  select jsonb_build_object(
    'campaigns_sent', count(distinct nc.id) filter (where nc.status in ('sent', 'partially_failed', 'failed')),
    'notifications_sent', count(*) filter (where nd.status in ('sent', 'delivered', 'opened', 'read', 'clicked')),
    'notifications_opened', count(*) filter (where nd.opened_at is not null),
    'notifications_clicked', count(*) filter (where nd.clicked_at is not null),
    'notifications_failed', count(*) filter (where nd.status = 'failed')
  )
  into v_result
  from public.notification_campaigns nc
  left join public.notification_deliveries nd on nd.campaign_id = nc.id
  where nc.created_at >= v_since;

  return v_result;
end;
$$;

revoke all on function public.admin_notification_campaign_period_summary(integer) from public, anon;
grant execute on function public.admin_notification_campaign_period_summary(integer) to authenticated;
