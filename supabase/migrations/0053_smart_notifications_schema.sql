-- Modulo G: Sistema Inteligente de Notificacoes Motivacionais e Lembretes.
-- Rodada 1/2: schema. Reaproveita 100% da infraestrutura de notificacoes ja
-- existente (push_subscriptions, notification_campaigns, notification_
-- deliveries, o cron unico, o dispatch engine) - nada aqui cria uma segunda
-- arquitetura de envio. Esta migration so adiciona: as 2 tabelas de
-- configuracao pedidas, as novas chaves de preferencia do usuario, e 2
-- colunas novas + 4 valores novos de audience_type em notification_campaigns
-- para as segmentacoes combinadas da Parte 11.

-- ============================================================
-- 1. challenge_habit_notifications (Parte 1/2)
-- ============================================================

create table if not exists public.challenge_habit_notifications (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  enabled boolean not null default false,
  notification_title text not null default '',
  notification_body text not null default '',
  -- Nunca hardcoded: horario e frequencia inteiramente configuraveis pelo
  -- admin, por habito. weekdays usa a mesma convencao de extract(dow from
  -- date) do Postgres (0=domingo .. 6=sabado) - "somente finais de semana"
  -- = [0,6], "somente dias uteis" = [1,2,3,4,5], "uma vez por semana" = um
  -- unico dia, "diario"/"personalizado" = qualquer subconjunto. "Mensal"
  -- nao cabe em dia-da-semana, por isso frequency_type+monthly_day cobrem
  -- esse caso especifico (Parte 7).
  notification_time time not null default '19:00',
  frequency_type text not null default 'weekly',
  weekdays jsonb not null default '[0,1,2,3,4,5,6]'::jsonb,
  monthly_day integer,
  only_if_not_completed boolean not null default true,
  priority integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (habit_id),
  constraint challenge_habit_notifications_frequency_type_check check (
    frequency_type in ('weekly', 'monthly')
  ),
  constraint challenge_habit_notifications_monthly_day_check check (
    (frequency_type <> 'monthly') or (monthly_day between 1 and 31)
  ),
  constraint challenge_habit_notifications_weekdays_check check (
    jsonb_typeof(weekdays) = 'array'
  ),
  constraint challenge_habit_notifications_priority_check check (
    priority between 1 and 10
  )
);

create index if not exists challenge_habit_notifications_enabled_idx
  on public.challenge_habit_notifications (habit_id) where enabled;

drop trigger if exists set_challenge_habit_notifications_updated_at on public.challenge_habit_notifications;
create trigger set_challenge_habit_notifications_updated_at
  before update on public.challenge_habit_notifications
  for each row execute function public.set_updated_at();

alter table public.challenge_habit_notifications enable row level security;

-- Mesmo padrao de habits/challenge_day_habits: leitura publica autenticada
-- (o app precisa ler para decidir prompts), escrita so admin. Nao existe
-- policy de escrita direta - toda mutacao passa pelas RPCs admin_* (ver
-- 0054), nunca um insert/update direto do cliente.
drop policy if exists "Anyone can read habit notification config" on public.challenge_habit_notifications;
create policy "Anyone can read habit notification config"
  on public.challenge_habit_notifications for select
  to authenticated
  using (true);

comment on table public.challenge_habit_notifications is
  'Config de lembrete inteligente por habito (Modulo G, Parte 1). Uma linha '
  'por habito no maximo (unique habit_id). O motor de envio real vive em '
  'automation_resolve_habit_reminder_candidates() + '
  'notification-automations.service.ts - reaproveita notification_campaigns/'
  'notification_deliveries, nunca uma fila paralela.';

-- ============================================================
-- 2. daily_motivation_messages (Parte 3/4)
-- ============================================================

create table if not exists public.daily_motivation_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'geral',
  active boolean not null default true,
  priority integer not null default 5,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_motivation_messages_category_check check (
    category in (
      'disciplina', 'fe', 'perseveranca', 'constancia', 'gratidao',
      'superacao', 'proposito', 'geral'
    )
  ),
  constraint daily_motivation_messages_priority_check check (
    priority between 1 and 10
  ),
  constraint daily_motivation_messages_window_check check (
    starts_at is null or ends_at is null or starts_at <= ends_at
  )
);

create index if not exists daily_motivation_messages_active_idx
  on public.daily_motivation_messages (category) where active;

drop trigger if exists set_daily_motivation_messages_updated_at on public.daily_motivation_messages;
create trigger set_daily_motivation_messages_updated_at
  before update on public.daily_motivation_messages
  for each row execute function public.set_updated_at();

alter table public.daily_motivation_messages enable row level security;

drop policy if exists "Admins can manage daily motivation messages" on public.daily_motivation_messages;
create policy "Admins can manage daily motivation messages"
  on public.daily_motivation_messages for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.daily_motivation_messages is
  'Mensagens cadastradas pelo Admin (nunca geradas por IA, nunca hardcoded '
  'no codigo) - Modulo G, Parte 3/4. category=''fe'' e a categoria de fe '
  'crista pedida na Parte 4; nao e uma tabela separada, so um valor de '
  'category como qualquer outro, com gate de preferencia proprio '
  '(faith_messages_enabled) resolvido em '
  'automation_resolve_daily_motivation_audience().';

-- ============================================================
-- 3. Novas chaves de preferencia (Parte 9)
-- ============================================================

-- "Avisos do desafio" e "Conquistas" e "Dicas" ja existem
-- (challenge_start_notifications / achievement_notifications /
-- new_tip_notifications) - reaproveitados, nao duplicados. Realmente novas:
-- motivacao, fe, lembretes de habito e campanhas do admin (que hoje nao tem
-- nenhum gate de preferencia proprio - iam sempre, sem opt-out).
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
      "important_updates_notifications": true,
      "daily_motivation_enabled": true,
      "faith_messages_enabled": true,
      "habit_reminders_enabled": true,
      "admin_campaign_notifications": true
    }'::jsonb
  );

update public.user_preferences
set notifications = (
  '{
    "daily_motivation_enabled": true,
    "faith_messages_enabled": true,
    "habit_reminders_enabled": true,
    "admin_campaign_notifications": true
  }'::jsonb || notifications
)
where not (
  notifications ? 'daily_motivation_enabled'
  and notifications ? 'faith_messages_enabled'
  and notifications ? 'habit_reminders_enabled'
  and notifications ? 'admin_campaign_notifications'
);

-- ============================================================
-- 4. notification_campaigns: colunas para segmentacao combinada (Parte 11)
-- ============================================================

alter table public.notification_campaigns
  add column if not exists min_streak_threshold integer,
  add column if not exists habit_keyword text;

alter table public.notification_campaigns
  drop constraint if exists notification_campaigns_min_streak_check;
alter table public.notification_campaigns
  add constraint notification_campaigns_min_streak_check check (
    min_streak_threshold is null or min_streak_threshold >= 0
  );

comment on column public.notification_campaigns.min_streak_threshold is
  'Filtro combinavel (Parte 11, "segmentacoes combinadas"): quando '
  'preenchido, intersecta o publico base com "streak_current >= este '
  'valor", em vez de exigir um audience_type dedicado por combinacao.';
comment on column public.notification_campaigns.habit_keyword is
  'Usado por audience_type = ''habit_keyword_not_completed_today'' - texto '
  'livre (ex.: "treino", "biblia", "oracao") comparado por ILIKE contra '
  'habits.title/category, cobrindo "quem ainda nao treinou/nao leu a '
  'biblia/nao orou hoje" sem precisar de 3 audience_type hardcoded.';

alter table public.notification_campaigns
  drop constraint if exists notification_campaigns_audience_type_check;
alter table public.notification_campaigns
  add constraint notification_campaigns_audience_type_check check (
    audience_type in (
      'all_active_users', 'specific_user', 'challenge_participants',
      'active_enrollment', 'day_not_finalized', 'day_finalized',
      'push_enabled', 'push_disabled_internal_only', 'admins', 'super_admins',
      'automation_daily_reminder', 'automation_challenge_starting_tomorrow',
      'automation_challenge_starting_today', 'automation_challenge_ending_soon',
      'automation_new_tip', 'automation_achievement_unlocked',
      'automation_inactive_user',
      'streak_above_threshold', 'streak_lost', 'day_all_habits_completed',
      'habit_keyword_not_completed_today',
      'automation_habit_reminder', 'automation_daily_motivation'
    )
  );
