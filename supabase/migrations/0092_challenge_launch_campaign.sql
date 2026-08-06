-- Campanha de lancamento configuravel por desafio (generica - nao exclusiva
-- do Efata). Hoje so existem automacoes de "lembrete para quem ja se
-- inscreveu" (automation_resolve_challenge_date_audience, migration 0048).
-- Esta migration adiciona o outro lado: uma sequencia de convite/pre-
-- lancamento para quem AINDA NAO se inscreveu, configuravel no Admin por
-- desafio, sem escrever codigo novo por ciclo.
--
-- Desenho deliberado (ver plano aprovado):
-- - 5 steps fixos por desafio (7/3/1 dias antes, dia do lancamento, reforco
--   do dia do lancamento), cada um com enabled/titulo/mensagem proprios.
-- - days_offset e sempre relativo a challenges.start_date - a data-alvo e
--   sempre recalculada (nunca persistida), entao mudar start_date
--   reprograma tudo automaticamente.
-- - send_time e so informativo/exibido no Admin - o cron de notificacoes
--   roda 1x/dia (~09h America/Sao_Paulo, ver vercel.json), entao o envio
--   real sai no proximo tick diario, nunca no horario exato configurado.
-- - Mesmo padrao de RLS de challenge_habit_notifications (migration 0054):
--   leitura para todo authenticated, escrita so admin via policy direta,
--   sem RPC (nao ha validacao cross-tabela alem do zod do lado TS).

create table public.challenge_launch_campaign_steps (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  step_key text not null,
  enabled boolean not null default false,
  days_offset integer not null,
  send_time time not null default '09:00',
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenge_launch_campaign_steps_step_key_check check (
    step_key in (
      'seven_days_before', 'three_days_before', 'one_day_before',
      'launch_day', 'launch_day_followup'
    )
  ),
  constraint challenge_launch_campaign_steps_challenge_step_key unique (challenge_id, step_key)
);

create index challenge_launch_campaign_steps_challenge_id_idx
  on public.challenge_launch_campaign_steps (challenge_id);

create trigger set_challenge_launch_campaign_steps_updated_at
  before update on public.challenge_launch_campaign_steps
  for each row execute function public.set_updated_at();

alter table public.challenge_launch_campaign_steps enable row level security;

create policy "Anyone can read launch campaign config"
  on public.challenge_launch_campaign_steps for select
  to authenticated
  using (true);

create policy "Admins can manage launch campaign config"
  on public.challenge_launch_campaign_steps for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Resolver: audiencia do convite/pre-lancamento - o oposto do resolver de
-- lembrete de entrada (migration 0048), que so pega quem JA se inscreveu.
-- Aqui e explicitamente quem NAO esta inscrito neste desafio. Reaproveita a
-- mesma preferencia ja usada pelo lembrete de entrada
-- (challenge_start_notifications) - nenhuma chave de preferencia nova.
create or replace function public.automation_resolve_challenge_launch_audience(p_challenge_id uuid)
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
    from public.users u
    left join public.user_preferences up on up.user_id = u.id
    where u.status = 'active'
      and u.deleted_at is null
      and coalesce((up.notifications ->> 'challenge_start_notifications')::boolean, true)
      and not exists (
        select 1 from public.challenge_enrollments ce
        where ce.challenge_id = p_challenge_id and ce.user_id = u.id
      );
end;
$$;

revoke all on function public.automation_resolve_challenge_launch_audience(uuid) from public, anon, authenticated;
grant execute on function public.automation_resolve_challenge_launch_audience(uuid) to service_role;

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
      'automation_habit_reminder', 'automation_daily_motivation',
      'automation_challenge_launch'
    )
  );
