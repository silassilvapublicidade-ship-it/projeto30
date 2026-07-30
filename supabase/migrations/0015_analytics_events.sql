-- Fase 6 (parte 2/4): estrutura minima de eventos de comportamento para o
-- funil de desafios.
--
-- AUDITORIA PREVIA: nenhuma tabela ou mecanismo de evento/telemetria de
-- comportamento existe no schema atual. public.admin_audit_logs (0001) e uma
-- trilha de auditoria de ACOES ADMINISTRATIVAS (quem alterou qual entidade,
-- before/after json) - formato e proposito diferentes, nao serve para
-- eventos de usuario final (nao tem event_name, nao tem metadata livre por
-- evento, nao e pensada para volume de eventos de navegacao). Metricas
-- transacionais completas ja existem via 0006_admin_analytics.sql (RPCs
-- admin_dashboard_overview, admin_challenge_detail etc.) e continuam sendo a
-- fonte de verdade para tudo que e derivavel do estado atual (inscritos,
-- conclusao, streak, progresso); esta tabela cobre apenas o que NAO pode ser
-- inferido do estado atual - o funil de intencao/comportamento antes e
-- durante a inscricao (visualizacao de catalogo/detalhe, clique em
-- participar, marcos de progresso).
--
-- DECISOES:
-- - user_id e anonymous_id nullable (nenhum dos dois obrigatorio sozinho):
--   nesta fase todo evento real vem de um usuario autenticado (a area do
--   membro exige sessao), entao anonymous_id fica reservado para uma fase
--   futura de instrumentacao de paginas publicas: nao e usado ainda, mas a
--   coluna evita uma migration extra quando isso for necessario.
-- - event_name e texto com CHECK (lista fechada) em vez de enum Postgres:
--   um enum exigiria uma migration propria so para adicionar cada evento
--   novo, e o valor novo nao pode ser usado na mesma transacao em que e
--   criado. Texto + check e mais simples de estender (uma linha em uma
--   migration futura) e ainda da protecao real contra nomes arbitrarios.
-- - challenge_id/enrollment_id nullable e SEM required combinado: alguns
--   eventos (ex.: share_achievement_started) nao tem desafio associado
--   diretamente.
-- - Nenhuma FK "on delete cascade" para challenges/challenge_enrollments:
--   um evento e um FATO HISTORICO (o usuario de fato visualizou o catalogo
--   naquele instante); nao deve desaparecer se o desafio for arquivado ou a
--   inscricao remota for reprocessada. Optou-se por "on delete set null"
--   para nao impedir a exclusao administrativa de um desafio nem inflar
--   erros de integridade, preservando o restante do evento.
-- - Idempotencia de marcos: um indice UNICO PARCIAL em (enrollment_id,
--   event_name), restrito aos nomes de evento que sao "marco unico por
--   inscricao" (challenge_joined, challenge_first_habit_completed,
--   challenge_day_7_reached, challenge_halfway_reached, challenge_completed,
--   challenge_abandoned). Eventos repetiveis por natureza (visualizacoes,
--   dia finalizado, cliques, compartilhamento) ficam fora deste indice.
-- - Nao ha coluna de e-mail, nem de conteudo de diario/texto livre do
--   usuario - metadata e populada apenas pelo codigo do servidor (nunca por
--   input arbitrario do cliente), e os pontos de insercao (proxima
--   migration) nunca colocam esses dados em metadata.
-- - Escrita: SEM policy de insert para authenticated/anon na tabela crua -
--   toda escrita passa pela funcao record_analytics_event() (security
--   definer, valida o whitelist de event_name, limita o tamanho de
--   metadata, usa auth.uid() internamente, nunca confia em user_id vindo do
--   cliente). Leitura: somente admin/super_admin (para os paineis).

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  anonymous_id text,
  event_name text not null,
  challenge_id uuid references public.challenges(id) on delete set null,
  enrollment_id uuid references public.challenge_enrollments(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  session_id text,
  source text not null default 'server',
  created_at timestamptz not null default now(),
  constraint analytics_events_event_name_check check (
    event_name in (
      'challenge_catalog_viewed',
      'challenge_detail_viewed',
      'challenge_join_clicked',
      'challenge_joined',
      'challenge_first_habit_completed',
      'challenge_day_completed',
      'challenge_day_7_reached',
      'challenge_halfway_reached',
      'challenge_completed',
      'challenge_abandoned',
      'share_achievement_started',
      'share_achievement_completed'
    )
  ),
  constraint analytics_events_source_check check (source in ('server', 'client')),
  constraint analytics_events_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists analytics_events_challenge_idx
  on public.analytics_events (challenge_id, event_name);

create index if not exists analytics_events_enrollment_idx
  on public.analytics_events (enrollment_id);

create index if not exists analytics_events_event_name_idx
  on public.analytics_events (event_name);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);

create index if not exists analytics_events_user_idx
  on public.analytics_events (user_id);

create unique index if not exists analytics_events_enrollment_milestone_unique
  on public.analytics_events (enrollment_id, event_name)
  where enrollment_id is not null
    and event_name in (
      'challenge_joined',
      'challenge_first_habit_completed',
      'challenge_day_7_reached',
      'challenge_halfway_reached',
      'challenge_completed',
      'challenge_abandoned'
    );

alter table public.analytics_events enable row level security;

create policy "Admins can read analytics events"
  on public.analytics_events for select
  to authenticated
  using (public.is_admin());

-- Nenhuma policy de insert/update/delete para authenticated/anon: a unica
-- via de escrita e a funcao abaixo (security definer), que roda com os
-- privilegios do dono da funcao e ignora RLS para o proprio insert, mas
-- valida tudo antes.

create or replace function public.record_analytics_event(
  p_event_name text,
  p_challenge_id uuid default null,
  p_enrollment_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_session_id text default null,
  p_source text default 'client'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  inserted_id uuid;
begin
  if p_event_name is null or p_event_name not in (
    'challenge_catalog_viewed',
    'challenge_detail_viewed',
    'challenge_join_clicked',
    'challenge_joined',
    'challenge_first_habit_completed',
    'challenge_day_completed',
    'challenge_day_7_reached',
    'challenge_halfway_reached',
    'challenge_completed',
    'challenge_abandoned',
    'share_achievement_started',
    'share_achievement_completed'
  ) then
    raise exception 'Nome de evento nao permitido.'
      using errcode = '22023';
  end if;

  if p_source not in ('server', 'client') then
    raise exception 'Origem de evento invalida.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(normalized_metadata) <> 'object' then
    raise exception 'Metadata de evento precisa ser um objeto JSON.'
      using errcode = '22023';
  end if;

  -- Limite defensivo de tamanho (evita payload arbitrario grande vindo do
  -- cliente); eventos legitimos desta fase nunca precisam de mais que isso.
  if octet_length(normalized_metadata::text) > 2000 then
    raise exception 'Metadata de evento excede o tamanho permitido.'
      using errcode = '22023';
  end if;

  if actor_id is null and p_source = 'client' then
    raise exception 'Sessao necessaria para registrar evento.'
      using errcode = '42501';
  end if;

  -- Se um enrollment_id foi informado, ele precisa realmente pertencer ao
  -- usuario autenticado - nunca confiar em enrollment_id vindo do cliente
  -- sem checar posse (evita poluir o funil de outro usuario).
  if p_enrollment_id is not null and actor_id is not null then
    if not exists (
      select 1
      from public.challenge_enrollments ce
      where ce.id = p_enrollment_id
        and ce.user_id = actor_id
    ) then
      raise exception 'Inscricao informada nao pertence ao usuario atual.'
        using errcode = '42501';
    end if;
  end if;

  -- Se um challenge_id foi informado, precisa existir (protege metricas de
  -- lixo em challenge_id arbitrario vindo do cliente).
  if p_challenge_id is not null and not exists (
    select 1 from public.challenges c where c.id = p_challenge_id
  ) then
    raise exception 'Desafio informado nao existe.'
      using errcode = '22023';
  end if;

  insert into public.analytics_events (
    user_id,
    event_name,
    challenge_id,
    enrollment_id,
    metadata,
    session_id,
    source
  )
  values (
    actor_id,
    p_event_name,
    p_challenge_id,
    p_enrollment_id,
    normalized_metadata,
    nullif(left(coalesce(p_session_id, ''), 200), ''),
    p_source
  )
  on conflict (enrollment_id, event_name) where enrollment_id is not null
    and event_name in (
      'challenge_joined',
      'challenge_first_habit_completed',
      'challenge_day_7_reached',
      'challenge_halfway_reached',
      'challenge_completed',
      'challenge_abandoned'
    )
  do nothing
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke execute on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text)
  to authenticated;

comment on table public.analytics_events is
  'Eventos de comportamento do funil de desafios (visualizacao, clique, '
  'marcos de progresso). Nao confundir com admin_audit_logs (trilha de '
  'acoes administrativas). Nunca contem e-mail, texto de diario ou outro '
  'conteudo sensivel - apenas metadata estruturada validada pelo servidor.';
