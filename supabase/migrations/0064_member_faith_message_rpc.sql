-- Dashboard de Evolucao Pessoal (Perfil) - Parte 4/4 (mensagem de fe e
-- proposito, item 13 do briefing).
--
-- AUDITORIA: daily_motivation_messages (Modulo G) so tem policy de RLS para
-- admin ("Admins can manage daily motivation messages", for all,
-- is_admin()) - um membro comum nao consegue ler a tabela diretamente. O
-- briefing pede "preferir conteudo configuravel pelo Admin ou mensagens ja
-- cadastradas... nao hardcodar dezenas de frases no componente" - a tabela
-- certa ja existe (reaproveitada, nunca uma segunda tabela de frases), so
-- falta uma via de leitura segura para o membro. RPC minima, sem
-- auth.uid() (a mensagem nao e por usuario, e um sorteio entre as
-- elegiveis), so exige sessao autenticada.

create or replace function public.member_pick_faith_message()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object('body', body, 'title', title)
    from public.daily_motivation_messages
    where active
      and category = 'fe'
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    order by random()
    limit 1
  ) end;
$$;

revoke all on function public.member_pick_faith_message() from public, anon;
grant execute on function public.member_pick_faith_message() to authenticated;

comment on function public.member_pick_faith_message() is
  'Sorteia uma mensagem ativa da categoria "fe" para o bloco de fe e '
  'proposito do Dashboard de Evolucao Pessoal - reaproveita '
  'daily_motivation_messages (Modulo G) em vez de uma tabela nova ou frases '
  'hardcoded. Retorna null quando nao ha nenhuma mensagem elegivel (o '
  'componente simplesmente nao renderiza a secao, nunca um texto vazio).';
