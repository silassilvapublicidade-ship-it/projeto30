-- Modulo F: Central de Notificacoes - schema principal (Rodada F1).
--
-- AUDITORIA PREVIA (ver relatorio da rodada): public.notifications e
-- public.notification_status ja existem desde 0001_initial_schema.sql e
-- estavam 100% dormentes - nenhuma linha de codigo em src/ ou em outra
-- migration os lia ou escrevia. Reaproveitados aqui (estendidos, nao
-- recriados) para a central interna. public.user_preferences.notifications
-- (jsonb) tambem ja existia com {email, in_app} - estendido, nao duplicado.
-- public.user_preferences.reminder_time e public.users.timezone ja existiam
-- e sao reaproveitados como estao (nenhuma coluna nova equivalente).
--
-- Tabelas novas nesta migration: push_subscriptions, notification_campaigns,
-- notification_deliveries - nenhuma tem equivalente anterior.
--
-- Padrao de mutacao: esta app usa RLS só para leitura e RPCs security
-- definer para toda escrita nas tabelas de journey (habit_logs, daily_logs
-- etc). notifications tinha uma excecao (policy de UPDATE direta + trigger
-- restritivo) - trocada aqui por RPCs dedicados (mark_notification_read /
-- _opened / _clicked / mark_all_notifications_read), pelo mesmo motivo:
-- múltiplos campos novos (opened_at, clicked_at) precisam de regras
-- diferentes por acao, o que um unico trigger de "so pode virar read" nao
-- cobre sem crescer descontroladamente.

-- ============================================================
-- 1. notifications - estender tabela existente
-- ============================================================

alter table public.notifications
  add column if not exists image_url text,
  add column if not exists action_label text,
  add column if not exists destination_type text,
  add column if not exists destination_reference_id text,
  add column if not exists campaign_id uuid,
  add column if not exists delivery_id uuid,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz;

-- Mesmo allowlist de destinos usado pelo service worker (public/sw.js) e
-- pelo compositor do admin - nunca uma URL externa livre.
alter table public.notifications
  drop constraint if exists notifications_destination_type_check;
alter table public.notifications
  add constraint notifications_destination_type_check check (
    destination_type is null or destination_type in (
      'hoje', 'desafios', 'desafio', 'jornada', 'dicas', 'dica',
      'conquistas', 'notificacoes', 'configuracoes_notificacoes'
    )
  );

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_status_idx
  on public.notifications (user_id, status);

-- O trigger antigo so permitia UPDATE de status ('read') pelo dono da
-- linha - substituido por RPCs dedicados (abaixo), que cobrem opened_at e
-- clicked_at tambem, sem crescer a logica de um unico trigger.
drop trigger if exists enforce_notification_user_read_update on public.notifications;
drop function if exists public.enforce_notification_user_read_update();
drop policy if exists "Users can mark own notifications read" on public.notifications;

-- ============================================================
-- 2. push_subscriptions - nova tabela
-- ============================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0
);

-- Um endpoint de push e unico por natureza (identifica um registro de
-- push especifico do navegador/dispositivo) - unique global, nao por
-- usuario. E exatamente essa unicidade que faz upsert_push_subscription
-- resolver troca de conta no mesmo aparelho corretamente (ver RPC abaixo).
create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id) where revoked_at is null;

drop trigger if exists set_push_subscriptions_updated_at on public.push_subscriptions;
create trigger set_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Escrita direta do cliente nao e permitida (mesmo padrao do resto do
-- app) - subscribe/unsubscribe passam pelas RPCs abaixo, que sao
-- security definer e reassociam o endpoint ao usuario da sessao atual.

-- ============================================================
-- 3. notification_campaigns - nova tabela
-- ============================================================

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  image_url text,
  action_label text,
  destination_type text not null,
  destination_reference_id text,
  audience_type text not null,
  challenge_id uuid references public.challenges(id) on delete set null,
  specific_user_id uuid references public.users(id) on delete set null,
  channel_internal boolean not null default true,
  channel_push boolean not null default true,
  status text not null default 'draft',
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text not null default gen_random_uuid()::text,
  metadata jsonb not null default '{}'::jsonb,
  -- 'admin': criada manualmente no compositor. 'automation': gerada pelo
  -- processador (lembrete diario, desafio amanha/hoje, dica publicada,
  -- conquista, fim do desafio, inatividade) - mesmo motor, mesma tabela,
  -- nunca uma fila paralela.
  source text not null default 'admin',
  automation_type text,
  audience_estimated_count integer,
  cancelled_by uuid references public.users(id) on delete set null,
  cancelled_at timestamptz,

  constraint notification_campaigns_destination_type_check check (
    destination_type in (
      'hoje', 'desafios', 'desafio', 'jornada', 'dicas', 'dica',
      'conquistas', 'notificacoes', 'configuracoes_notificacoes'
    )
  ),
  constraint notification_campaigns_audience_type_check check (
    audience_type in (
      'all_active_users', 'specific_user', 'challenge_participants',
      'active_enrollment', 'day_not_finalized', 'day_finalized',
      'push_enabled', 'push_disabled_internal_only', 'admins', 'super_admins'
    )
  ),
  constraint notification_campaigns_status_check check (
    status in (
      'draft', 'scheduled', 'processing', 'sent', 'partially_failed',
      'failed', 'cancelled'
    )
  ),
  constraint notification_campaigns_source_check check (
    source in ('admin', 'automation')
  ),
  constraint notification_campaigns_channel_check check (
    channel_internal or channel_push
  ),
  constraint notification_campaigns_metadata_is_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

create unique index if not exists notification_campaigns_idempotency_key_key
  on public.notification_campaigns (idempotency_key);
create index if not exists notification_campaigns_status_idx
  on public.notification_campaigns (status);
create index if not exists notification_campaigns_scheduled_for_idx
  on public.notification_campaigns (scheduled_for) where status = 'scheduled';

drop trigger if exists set_notification_campaigns_updated_at on public.notification_campaigns;
create trigger set_notification_campaigns_updated_at
  before update on public.notification_campaigns
  for each row execute function public.set_updated_at();

alter table public.notification_campaigns enable row level security;

drop policy if exists "Admins can manage notification campaigns" on public.notification_campaigns;
create policy "Admins can manage notification campaigns"
  on public.notification_campaigns for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- 4. notification_deliveries - nova tabela
-- ============================================================

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.notification_campaigns(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  internal_notification_id uuid references public.notifications(id) on delete set null,
  status text not null default 'pending',
  scheduled_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  read_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  retry_count integer not null default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text not null,

  constraint notification_deliveries_status_check check (
    status in (
      'pending', 'sent', 'delivered', 'opened', 'read', 'clicked',
      'failed', 'cancelled'
    )
  )
);

create unique index if not exists notification_deliveries_idempotency_key_key
  on public.notification_deliveries (idempotency_key);
create unique index if not exists notification_deliveries_campaign_user_key
  on public.notification_deliveries (campaign_id, user_id);
create index if not exists notification_deliveries_status_idx
  on public.notification_deliveries (status);
create index if not exists notification_deliveries_retry_idx
  on public.notification_deliveries (next_retry_at) where status = 'failed';
create index if not exists notification_deliveries_user_idx
  on public.notification_deliveries (user_id);

drop trigger if exists set_notification_deliveries_updated_at on public.notification_deliveries;
create trigger set_notification_deliveries_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;

drop policy if exists "Admins can manage notification deliveries" on public.notification_deliveries;
create policy "Admins can manage notification deliveries"
  on public.notification_deliveries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- notifications.campaign_id / delivery_id FKs (added after both tables exist)
alter table public.notifications
  drop constraint if exists notifications_campaign_id_fkey;
alter table public.notifications
  add constraint notifications_campaign_id_fkey
  foreign key (campaign_id) references public.notification_campaigns(id) on delete set null;

alter table public.notifications
  drop constraint if exists notifications_delivery_id_fkey;
alter table public.notifications
  add constraint notifications_delivery_id_fkey
  foreign key (delivery_id) references public.notification_deliveries(id) on delete set null;

-- ============================================================
-- 5. user_preferences.notifications - estender o jsonb existente
-- ============================================================

-- Novo default para linhas futuras. Linhas existentes sao mescladas
-- (nao sobrescritas) logo abaixo, preservando qualquer valor real que o
-- usuario ja tenha (email/in_app).
alter table public.user_preferences
  alter column notifications set default (
    '{
      "email": false,
      "in_app": true,
      "push_enabled": false,
      "daily_reminder_enabled": false,
      "challenge_start_notifications": true,
      "new_tip_notifications": true,
      "achievement_notifications": true,
      "important_updates_notifications": true
    }'::jsonb
  );

update public.user_preferences
set notifications = (
  '{
    "push_enabled": false,
    "daily_reminder_enabled": false,
    "challenge_start_notifications": true,
    "new_tip_notifications": true,
    "achievement_notifications": true,
    "important_updates_notifications": true
  }'::jsonb || notifications
)
where not (
  notifications ? 'push_enabled'
  and notifications ? 'daily_reminder_enabled'
  and notifications ? 'challenge_start_notifications'
  and notifications ? 'new_tip_notifications'
  and notifications ? 'achievement_notifications'
  and notifications ? 'important_updates_notifications'
);

-- ============================================================
-- 6. RPCs - central interna (marcar lida / aberta / clicada)
-- ============================================================

create or replace function public.mark_notification_read(p_notification_id uuid)
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

  update public.notifications
  set status = 'read',
      read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = actor_id;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  updated_count integer;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  update public.notifications
  set status = 'read',
      read_at = coalesce(read_at, now())
  where user_id = actor_id
    and status <> 'read';

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.mark_notification_opened(p_notification_id uuid)
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

  update public.notifications
  set opened_at = coalesce(opened_at, now())
  where id = p_notification_id
    and user_id = actor_id;
end;
$$;

-- Clicar (push ou item da central) implica ter aberto e lido - nao existe
-- um evento de "abertura" separado e posterior para uma notificacao push
-- clicada fora da central, entao clicked marca as tres coisas de uma vez
-- quando ainda nao tinham valor.
create or replace function public.mark_notification_clicked(p_notification_id uuid)
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

  update public.notifications
  set clicked_at = coalesce(clicked_at, now()),
      opened_at = coalesce(opened_at, now()),
      status = 'read',
      read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = actor_id;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
revoke all on function public.mark_notification_opened(uuid) from public, anon;
revoke all on function public.mark_notification_clicked(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.mark_notification_opened(uuid) to authenticated;
grant execute on function public.mark_notification_clicked(uuid) to authenticated;

-- ============================================================
-- 7. RPCs - push subscriptions
-- ============================================================

-- on conflict(endpoint) reassocia o endpoint ao usuario da sessao atual -
-- e exatamente isso que resolve troca de conta no mesmo aparelho: se B
-- ativa push no mesmo navegador onde A ativou antes, o endpoint (unico
-- por natureza) e reatribuido a B e revoked_at volta a null.
create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default null,
  p_device_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_id uuid;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  if p_endpoint is null or length(trim(p_endpoint)) = 0 then
    raise exception 'Endpoint invalido.' using errcode = '22023';
  end if;

  if p_p256dh is null or p_auth is null or length(trim(p_p256dh)) = 0 or length(trim(p_auth)) = 0 then
    raise exception 'Chaves de subscription invalidas.' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent, platform, device_name
  )
  values (
    actor_id, p_endpoint, p_p256dh, p_auth,
    nullif(left(coalesce(p_user_agent, ''), 400), ''),
    nullif(left(coalesce(p_platform, ''), 60), ''),
    nullif(left(coalesce(p_device_name, ''), 120), '')
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        platform = excluded.platform,
        device_name = excluded.device_name,
        revoked_at = null,
        failure_count = 0,
        updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

-- Revoga (soft) apenas o endpoint informado, e apenas se pertencer ao
-- usuario atual - usado no logout (o cliente le a subscription do
-- navegador via pushManager.getSubscription() e envia so o endpoint,
-- nunca as chaves). Nunca desativa a permissao do navegador em si.
create or replace function public.revoke_push_subscription(p_endpoint text)
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

  update public.push_subscriptions
  set revoked_at = now()
  where endpoint = p_endpoint
    and user_id = actor_id
    and revoked_at is null;
end;
$$;

revoke all on function public.upsert_push_subscription(text, text, text, text, text, text) from public, anon;
revoke all on function public.revoke_push_subscription(text) from public, anon;
grant execute on function public.upsert_push_subscription(text, text, text, text, text, text) to authenticated;
grant execute on function public.revoke_push_subscription(text) to authenticated;

comment on table public.push_subscriptions is
  'Web Push subscriptions (endpoint/p256dh/auth). p256dh/auth nunca devem '
  'ser selecionados pela UI do admin - so o backend (service role) le essas '
  'colunas, para montar o payload de envio.';

comment on table public.notification_campaigns is
  'Fonte unica de verdade para agendamento/envio, tanto para campanhas '
  'criadas manualmente pelo admin (source=admin) quanto para automacoes '
  '(source=automation) - nunca duas filas paralelas.';

comment on table public.notification_deliveries is
  'Uma linha por usuario e campanha. idempotency_key garante que retry '
  'nunca duplica envio.';
