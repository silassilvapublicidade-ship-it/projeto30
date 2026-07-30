-- Fase 6 (parte 4/4): suporte de servidor para o editor visual de desafios
-- (geracao transacional de dias) e para o funil administrativo (leitura
-- agregada de public.analytics_events por desafio).
--
-- AUDITORIA PREVIA: nao existe hoje nenhuma RPC de escrita em massa para
-- challenge_days/challenge_day_habits (a unica forma de criar isso hoje e um
-- script SQL avulso, scripts/challenges/create-august-irreconhecivel.sql).
-- Para o editor admin, a geracao de dias precisa ser UMA operacao atomica
-- (tudo ou nada) executada a partir do TypeScript - por isso vira uma unica
-- funcao security definer em vez de varias chamadas .insert() encadeadas
-- pelo Supabase-js (que nao compartilhariam uma transacao real).
--
-- admin_generate_challenge_days(p_challenge_id):
-- - Somente para desafios em 'draft' (regra explicita desta fase: a acao
--   "gerar dias" so roda em rascunho).
-- - Idempotente: cria challenge_days para os numeros de dia que ainda nao
--   existem (nunca duplica um day_number ja existente - a unique constraint
--   (challenge_id, day_number) ja impede isso, mas o "on conflict do
--   nothing" evita erro e permite rodar a acao de novo apos adicionar mais
--   habitos).
-- - Faz o cross-join de TODOS os habitos ativos do desafio com TODOS os dias
--   (existentes + recem-criados), inserindo apenas os pares que ainda nao
--   existem em challenge_day_habits (on conflict do nothing) - nunca
--   sobrescreve um override_points/override_description ja customizado
--   manualmente em um par existente.
-- - Roda inteira dentro do corpo da funcao (uma unica chamada = uma
--   transacao implicita do Postgres) - publicacao parcial e impossivel: ou
--   a funcao inteira aplica, ou nenhuma linha e gravada.
create or replace function public.admin_generate_challenge_days(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge record;
  v_day_number integer;
  v_days_before integer := 0;
  v_days_after integer := 0;
  v_links_before integer := 0;
  v_links_after integer := 0;
begin
  perform public.admin_require_admin();

  select id, duration_days, status
  into v_challenge
  from public.challenges
  where id = p_challenge_id
    and deleted_at is null
  for update;

  if v_challenge.id is null then
    raise exception 'Desafio nao encontrado.'
      using errcode = 'P0002';
  end if;

  if v_challenge.status <> 'draft'::public.challenge_status then
    raise exception 'A geracao de dias so pode ser executada com o desafio em rascunho.'
      using errcode = '22023';
  end if;

  select count(*) into v_days_before
  from public.challenge_days where challenge_id = p_challenge_id;

  select count(*) into v_links_before
  from public.challenge_day_habits where challenge_id = p_challenge_id;

  for v_day_number in 1..v_challenge.duration_days loop
    insert into public.challenge_days (challenge_id, day_number, unlock_rule)
    values (p_challenge_id, v_day_number, jsonb_build_object('type', 'sequential'))
    on conflict (challenge_id, day_number) do nothing;
  end loop;

  insert into public.challenge_day_habits (
    challenge_id,
    challenge_day_id,
    habit_id,
    sort_order,
    required
  )
  select
    p_challenge_id,
    cd.id,
    h.id,
    h.sort_order,
    h.is_required
  from public.challenge_days cd
  cross join public.habits h
  where cd.challenge_id = p_challenge_id
    and h.challenge_id = p_challenge_id
    and h.active
  on conflict (challenge_day_id, habit_id) do nothing;

  select count(*) into v_days_after
  from public.challenge_days where challenge_id = p_challenge_id;

  select count(*) into v_links_after
  from public.challenge_day_habits where challenge_id = p_challenge_id;

  return jsonb_build_object(
    'days_created', v_days_after - v_days_before,
    'days_total', v_days_after,
    'links_created', v_links_after - v_links_before,
    'links_total', v_links_after
  );
end;
$$;

revoke execute on function public.admin_generate_challenge_days(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_generate_challenge_days(uuid)
  to authenticated;

-- admin_challenge_funnel(p_challenge_id): agrega public.analytics_events em
-- estagios fixos do funil de UM desafio. O funil comeca em
-- "detail_views" (challenge_detail_viewed e um evento POR VISUALIZACAO, nao
-- por inscricao - por isso e contagem simples). Os demais estagios sao
-- contagem de INSCRICOES DISTINTAS que atingiram aquele marco (cada evento
-- de marco e unico por enrollment_id, ver indice parcial em
-- 0015_analytics_events.sql, entao count(*) e count(distinct enrollment_id)
-- dao o mesmo numero para eles - usamos distinct para deixar a intencao
-- explicita mesmo assim). 'challenge_catalog_viewed' fica de fora deste
-- funil por desafio porque e emitido sem challenge_id (visualizacao do
-- catalogo geral, nao de um desafio especifico) - aparece apenas como
-- metrica global (ver admin_dashboard_overview, nao alterada aqui).
create or replace function public.admin_challenge_funnel(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_detail_views integer := 0;
  v_join_clicks integer := 0;
  v_joined integer := 0;
  v_first_habit integer := 0;
  v_day_7 integer := 0;
  v_halfway integer := 0;
  v_completed integer := 0;
  v_abandoned integer := 0;
begin
  perform public.admin_require_admin();

  select
    count(*) filter (where event_name = 'challenge_detail_viewed'),
    count(*) filter (where event_name = 'challenge_join_clicked'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_joined'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_first_habit_completed'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_day_7_reached'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_halfway_reached'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_completed'),
    count(distinct enrollment_id) filter (where event_name = 'challenge_abandoned')
  into
    v_detail_views,
    v_join_clicks,
    v_joined,
    v_first_habit,
    v_day_7,
    v_halfway,
    v_completed,
    v_abandoned
  from public.analytics_events
  where challenge_id = p_challenge_id;

  return jsonb_build_object(
    'stages', jsonb_build_array(
      jsonb_build_object('key', 'detail_viewed', 'label', 'Visualizou o detalhe', 'value', v_detail_views),
      jsonb_build_object('key', 'join_clicked', 'label', 'Clicou em participar', 'value', v_join_clicks),
      jsonb_build_object('key', 'joined', 'label', 'Inscricao concluida', 'value', v_joined),
      jsonb_build_object('key', 'first_habit', 'label', 'Primeiro habito', 'value', v_first_habit),
      jsonb_build_object('key', 'day_7', 'label', 'Chegou ao dia 7', 'value', v_day_7),
      jsonb_build_object('key', 'halfway', 'label', 'Chegou na metade', 'value', v_halfway),
      jsonb_build_object('key', 'completed', 'label', 'Concluiu o desafio', 'value', v_completed),
      jsonb_build_object('key', 'abandoned', 'label', 'Abandonou', 'value', v_abandoned)
    )
  );
end;
$$;

revoke execute on function public.admin_challenge_funnel(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_challenge_funnel(uuid)
  to authenticated;

comment on function public.admin_challenge_funnel(uuid) is
  'Funil de comportamento por desafio, lido de public.analytics_events. '
  'challenge_abandoned nunca e emitido nesta fase (nenhum fluxo de aplicacao '
  'ainda transiciona uma inscricao para status abandoned) - o estagio '
  'aparece zerado ate que essa transicao exista em uma fase futura.';
