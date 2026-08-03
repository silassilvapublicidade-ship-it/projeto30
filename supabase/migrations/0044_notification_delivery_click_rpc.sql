-- Modulo F: RPC dedicada para o service worker registrar o clique em uma
-- notificacao push no nivel de notification_deliveries (analytics por
-- campanha) - notification_deliveries so tem policy de admin (RLS), entao
-- o navegador do usuario final nao pode fazer UPDATE direto nela; esta
-- funcao security definer confere que a delivery pertence ao chamador
-- antes de tocar a linha, igual ao resto das RPCs deste modulo.
create or replace function public.mark_delivery_clicked(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  update public.notification_deliveries
  set clicked_at = coalesce(clicked_at, now()),
      opened_at = coalesce(opened_at, now()),
      status = 'clicked'
  where id = p_delivery_id
    and user_id = actor_id;
end;
$$;

revoke all on function public.mark_delivery_clicked(uuid) from public, anon;
grant execute on function public.mark_delivery_clicked(uuid) to authenticated;
