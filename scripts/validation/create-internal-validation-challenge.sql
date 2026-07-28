-- Projeto 30 - internal validation challenge
--
-- Purpose:
-- Creates a real, minimal, controlled remote challenge for Fase 2E end-to-end
-- validation. This is administrative validation data, not a seed and not a
-- migration.
--
-- Safety:
-- - Run only against the linked Supabase remote project when explicitly approved.
-- - Usage: npx.cmd supabase db query --linked --file scripts\validation\create-internal-validation-challenge.sql
-- - Idempotent: fixed UUIDs + ON CONFLICT updates for this validation dataset.
-- - Does not create auth users.
-- - Does not create enrollments, daily logs, habit logs, journal entries,
--   point events, or user achievements.
-- - Does not delete or mutate user journey data.
-- - The destructive cleanup block at the end is fully commented out and must
--   never be uncommented without explicit approval.
--
-- Fixed IDs created:
-- Challenge:
--   a2300000-0000-4000-8000-000000000001
-- Days:
--   a2300000-0000-4000-8001-000000000001 .. a2300000-0000-4000-8001-000000000007
-- Habits:
--   a2300000-0000-4000-8002-000000000001 .. a2300000-0000-4000-8002-000000000005
-- Achievements:
--   a2300000-0000-4000-8003-000000000001 .. a2300000-0000-4000-8003-000000000010
-- Day-habit links:
--   a2300000-0000-4000-8101-000000000001 .. a2300000-0000-4000-8107-000000000005

begin;

do $$
begin
  if exists (
    select 1
    from public.challenges
    where slug = 'projeto-30-validacao-interna'
      and id <> 'a2300000-0000-4000-8000-000000000001'::uuid
  ) then
    raise exception
      'Validation challenge slug already exists with a different id. Aborting to avoid mutating unrelated data.';
  end if;
end;
$$;

insert into public.challenges (
  id,
  name,
  slug,
  description,
  duration_days,
  start_date,
  end_date,
  enrollment_start,
  enrollment_end,
  status,
  theme_config,
  rules_config
)
values (
  'a2300000-0000-4000-8000-000000000001',
  'Projeto 30 - Validacao Interna',
  'projeto-30-validacao-interna',
  'Ciclo administrativo privado para validar a jornada diaria real do Projeto 30 em ambiente remoto controlado.',
  7,
  timezone('America/Sao_Paulo', now())::date,
  timezone('America/Sao_Paulo', now())::date + 60,
  timezone('America/Sao_Paulo', now())::date - 1,
  timezone('America/Sao_Paulo', now())::date + 60,
  'active',
  jsonb_build_object(
    'scope', 'internal-validation',
    'visibility', 'internal',
    'timezone', 'America/Sao_Paulo'
  ),
  jsonb_build_object(
    'reflection_points', 10,
    'finalize_day_points', 10,
    'all_habits_bonus_points', 30,
    'streak_minimum_completion', 70,
    'journal_edit_minutes_after_finalize', 0
  )
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  duration_days = excluded.duration_days,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  enrollment_start = excluded.enrollment_start,
  enrollment_end = excluded.enrollment_end,
  status = excluded.status,
  theme_config = excluded.theme_config,
  rules_config = excluded.rules_config,
  updated_at = now();

insert into public.challenge_days (
  id,
  challenge_id,
  day_number,
  title,
  message,
  theme,
  unlock_rule
)
values
  (
    'a2300000-0000-4000-8001-000000000001',
    'a2300000-0000-4000-8000-000000000001',
    1,
    'Dia 1 - O começo',
    'Hoje nao precisa ser perfeito. Precisa comecar com honestidade.',
    'Escolha constancia antes de intensidade.',
    '{"type": "sequential"}'::jsonb
  ),
  (
    'a2300000-0000-4000-8001-000000000002',
    'a2300000-0000-4000-8000-000000000001',
    2,
    'Dia 2 - Continue',
    'A decisao de ontem ganha corpo quando voce repete hoje.',
    'Voltar e uma forma de vencer.',
    '{"type": "sequential"}'::jsonb
  ),
  (
    'a2300000-0000-4000-8001-000000000003',
    'a2300000-0000-4000-8000-000000000001',
    3,
    'Dia 3 - Constancia',
    'Constancia nao e pressa. E presenca repetida.',
    'Menos promessa, mais pratica.',
    '{"type": "sequential"}'::jsonb
  ),
  (
    'a2300000-0000-4000-8001-000000000004',
    'a2300000-0000-4000-8000-000000000001',
    4,
    'Dia 4 - Mesmo sem vontade',
    'Nem todo dia vem com vontade. Alguns dias pedem direcao.',
    'Faça pequeno, mas faça.',
    '{"type": "sequential"}'::jsonb
  ),
  (
    'a2300000-0000-4000-8001-000000000005',
    'a2300000-0000-4000-8000-000000000001',
    5,
    'Dia 5 - Voce esta mudando',
    'Mudanca real costuma aparecer primeiro no jeito de voltar.',
    'Reconheca o progresso sem inflar a meta.',
    '{"type": "sequential"}'::jsonb
  ),
  (
    'a2300000-0000-4000-8001-000000000006',
    'a2300000-0000-4000-8000-000000000001',
    6,
    'Dia 6 - Nao pare agora',
    'O ritmo que voce protege hoje sustenta a pessoa que voce esta formando.',
    'Proteja o proximo passo.',
    '{"type": "sequential"}'::jsonb
  ),
  (
    'a2300000-0000-4000-8001-000000000007',
    'a2300000-0000-4000-8000-000000000001',
    7,
    'Dia 7 - Primeira etapa concluida',
    'Uma semana nao encerra a jornada. Ela prova que voce pode continuar.',
    'Concluir tambem e aprender a recomecar.',
    '{"type": "sequential"}'::jsonb
  )
on conflict (challenge_id, day_number) do update set
  title = excluded.title,
  message = excluded.message,
  theme = excluded.theme,
  unlock_rule = excluded.unlock_rule,
  updated_at = now();

insert into public.habits (
  id,
  challenge_id,
  title,
  description,
  category,
  habit_type,
  icon,
  points,
  is_required,
  frequency_config,
  validation_config,
  sort_order,
  active
)
values
  (
    'a2300000-0000-4000-8002-000000000001',
    'a2300000-0000-4000-8000-000000000001',
    'Treinei hoje',
    'Confirme se voce realizou uma atividade fisica hoje, mesmo que tenha sido simples.',
    'atividade física',
    'boolean',
    'activity',
    20,
    true,
    '{"type": "daily"}'::jsonb,
    '{"label": "Confirmar com honestidade"}'::jsonb,
    10,
    true
  ),
  (
    'a2300000-0000-4000-8002-000000000002',
    'a2300000-0000-4000-8000-000000000001',
    'Leitura do dia',
    'Conclua a leitura proposta para manter clareza e direcao.',
    'leitura',
    'reading',
    'book-open',
    15,
    true,
    '{"type": "daily"}'::jsonb,
    '{"target": "Leitura do dia", "unit": "conclusao", "source": "daily-reading"}'::jsonb,
    20,
    true
  ),
  (
    'a2300000-0000-4000-8002-000000000003',
    'a2300000-0000-4000-8000-000000000001',
    'Agua',
    'Registre a quantidade de agua consumida ao longo do dia.',
    'saude',
    'quantity',
    'droplets',
    15,
    true,
    '{"type": "daily"}'::jsonb,
    '{"target": 3000, "unit": "ml", "metric": "agua"}'::jsonb,
    30,
    true
  ),
  (
    'a2300000-0000-4000-8002-000000000004',
    'a2300000-0000-4000-8000-000000000001',
    'Movimento',
    'Registre minutos de movimento consciente para validar habitos por duracao.',
    'movimento',
    'duration',
    'timer',
    20,
    true,
    '{"type": "daily"}'::jsonb,
    '{"target": 30, "unit": "minutos", "metric": "movimento"}'::jsonb,
    40,
    true
  ),
  (
    'a2300000-0000-4000-8002-000000000005',
    'a2300000-0000-4000-8000-000000000001',
    'Oracao e gratidao',
    'Separe um momento breve para oracao, gratidao ou silencio intencional.',
    'espiritual',
    'boolean',
    'sparkles',
    20,
    true,
    '{"type": "daily"}'::jsonb,
    '{"label": "Registrar presenca"}'::jsonb,
    50,
    true
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  habit_type = excluded.habit_type,
  icon = excluded.icon,
  points = excluded.points,
  is_required = excluded.is_required,
  frequency_config = excluded.frequency_config,
  validation_config = excluded.validation_config,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

with validation_links(id, day_id, habit_id, sort_order) as (
  values
    ('a2300000-0000-4000-8101-000000000001'::uuid, 'a2300000-0000-4000-8001-000000000001'::uuid, 'a2300000-0000-4000-8002-000000000001'::uuid, 10),
    ('a2300000-0000-4000-8101-000000000002'::uuid, 'a2300000-0000-4000-8001-000000000001'::uuid, 'a2300000-0000-4000-8002-000000000002'::uuid, 20),
    ('a2300000-0000-4000-8101-000000000003'::uuid, 'a2300000-0000-4000-8001-000000000001'::uuid, 'a2300000-0000-4000-8002-000000000003'::uuid, 30),
    ('a2300000-0000-4000-8101-000000000004'::uuid, 'a2300000-0000-4000-8001-000000000001'::uuid, 'a2300000-0000-4000-8002-000000000004'::uuid, 40),
    ('a2300000-0000-4000-8101-000000000005'::uuid, 'a2300000-0000-4000-8001-000000000001'::uuid, 'a2300000-0000-4000-8002-000000000005'::uuid, 50),
    ('a2300000-0000-4000-8102-000000000001'::uuid, 'a2300000-0000-4000-8001-000000000002'::uuid, 'a2300000-0000-4000-8002-000000000001'::uuid, 10),
    ('a2300000-0000-4000-8102-000000000002'::uuid, 'a2300000-0000-4000-8001-000000000002'::uuid, 'a2300000-0000-4000-8002-000000000002'::uuid, 20),
    ('a2300000-0000-4000-8102-000000000003'::uuid, 'a2300000-0000-4000-8001-000000000002'::uuid, 'a2300000-0000-4000-8002-000000000003'::uuid, 30),
    ('a2300000-0000-4000-8102-000000000004'::uuid, 'a2300000-0000-4000-8001-000000000002'::uuid, 'a2300000-0000-4000-8002-000000000004'::uuid, 40),
    ('a2300000-0000-4000-8102-000000000005'::uuid, 'a2300000-0000-4000-8001-000000000002'::uuid, 'a2300000-0000-4000-8002-000000000005'::uuid, 50),
    ('a2300000-0000-4000-8103-000000000001'::uuid, 'a2300000-0000-4000-8001-000000000003'::uuid, 'a2300000-0000-4000-8002-000000000001'::uuid, 10),
    ('a2300000-0000-4000-8103-000000000002'::uuid, 'a2300000-0000-4000-8001-000000000003'::uuid, 'a2300000-0000-4000-8002-000000000002'::uuid, 20),
    ('a2300000-0000-4000-8103-000000000003'::uuid, 'a2300000-0000-4000-8001-000000000003'::uuid, 'a2300000-0000-4000-8002-000000000003'::uuid, 30),
    ('a2300000-0000-4000-8103-000000000004'::uuid, 'a2300000-0000-4000-8001-000000000003'::uuid, 'a2300000-0000-4000-8002-000000000004'::uuid, 40),
    ('a2300000-0000-4000-8103-000000000005'::uuid, 'a2300000-0000-4000-8001-000000000003'::uuid, 'a2300000-0000-4000-8002-000000000005'::uuid, 50),
    ('a2300000-0000-4000-8104-000000000001'::uuid, 'a2300000-0000-4000-8001-000000000004'::uuid, 'a2300000-0000-4000-8002-000000000001'::uuid, 10),
    ('a2300000-0000-4000-8104-000000000002'::uuid, 'a2300000-0000-4000-8001-000000000004'::uuid, 'a2300000-0000-4000-8002-000000000002'::uuid, 20),
    ('a2300000-0000-4000-8104-000000000003'::uuid, 'a2300000-0000-4000-8001-000000000004'::uuid, 'a2300000-0000-4000-8002-000000000003'::uuid, 30),
    ('a2300000-0000-4000-8104-000000000004'::uuid, 'a2300000-0000-4000-8001-000000000004'::uuid, 'a2300000-0000-4000-8002-000000000004'::uuid, 40),
    ('a2300000-0000-4000-8104-000000000005'::uuid, 'a2300000-0000-4000-8001-000000000004'::uuid, 'a2300000-0000-4000-8002-000000000005'::uuid, 50),
    ('a2300000-0000-4000-8105-000000000001'::uuid, 'a2300000-0000-4000-8001-000000000005'::uuid, 'a2300000-0000-4000-8002-000000000001'::uuid, 10),
    ('a2300000-0000-4000-8105-000000000002'::uuid, 'a2300000-0000-4000-8001-000000000005'::uuid, 'a2300000-0000-4000-8002-000000000002'::uuid, 20),
    ('a2300000-0000-4000-8105-000000000003'::uuid, 'a2300000-0000-4000-8001-000000000005'::uuid, 'a2300000-0000-4000-8002-000000000003'::uuid, 30),
    ('a2300000-0000-4000-8105-000000000004'::uuid, 'a2300000-0000-4000-8001-000000000005'::uuid, 'a2300000-0000-4000-8002-000000000004'::uuid, 40),
    ('a2300000-0000-4000-8105-000000000005'::uuid, 'a2300000-0000-4000-8001-000000000005'::uuid, 'a2300000-0000-4000-8002-000000000005'::uuid, 50),
    ('a2300000-0000-4000-8106-000000000001'::uuid, 'a2300000-0000-4000-8001-000000000006'::uuid, 'a2300000-0000-4000-8002-000000000001'::uuid, 10),
    ('a2300000-0000-4000-8106-000000000002'::uuid, 'a2300000-0000-4000-8001-000000000006'::uuid, 'a2300000-0000-4000-8002-000000000002'::uuid, 20),
    ('a2300000-0000-4000-8106-000000000003'::uuid, 'a2300000-0000-4000-8001-000000000006'::uuid, 'a2300000-0000-4000-8002-000000000003'::uuid, 30),
    ('a2300000-0000-4000-8106-000000000004'::uuid, 'a2300000-0000-4000-8001-000000000006'::uuid, 'a2300000-0000-4000-8002-000000000004'::uuid, 40),
    ('a2300000-0000-4000-8106-000000000005'::uuid, 'a2300000-0000-4000-8001-000000000006'::uuid, 'a2300000-0000-4000-8002-000000000005'::uuid, 50),
    ('a2300000-0000-4000-8107-000000000001'::uuid, 'a2300000-0000-4000-8001-000000000007'::uuid, 'a2300000-0000-4000-8002-000000000001'::uuid, 10),
    ('a2300000-0000-4000-8107-000000000002'::uuid, 'a2300000-0000-4000-8001-000000000007'::uuid, 'a2300000-0000-4000-8002-000000000002'::uuid, 20),
    ('a2300000-0000-4000-8107-000000000003'::uuid, 'a2300000-0000-4000-8001-000000000007'::uuid, 'a2300000-0000-4000-8002-000000000003'::uuid, 30),
    ('a2300000-0000-4000-8107-000000000004'::uuid, 'a2300000-0000-4000-8001-000000000007'::uuid, 'a2300000-0000-4000-8002-000000000004'::uuid, 40),
    ('a2300000-0000-4000-8107-000000000005'::uuid, 'a2300000-0000-4000-8001-000000000007'::uuid, 'a2300000-0000-4000-8002-000000000005'::uuid, 50)
)
insert into public.challenge_day_habits (
  id,
  challenge_id,
  challenge_day_id,
  habit_id,
  override_points,
  override_description,
  sort_order,
  required
)
select
  id,
  'a2300000-0000-4000-8000-000000000001'::uuid,
  day_id,
  habit_id,
  null,
  null,
  sort_order,
  true
from validation_links
on conflict (challenge_day_id, habit_id) do update set
  override_points = excluded.override_points,
  override_description = excluded.override_description,
  sort_order = excluded.sort_order,
  required = excluded.required,
  updated_at = now();

insert into public.achievements (
  id,
  challenge_id,
  name,
  slug,
  description,
  icon,
  points_bonus,
  rule_config,
  active,
  sort_order
)
values
  (
    'a2300000-0000-4000-8003-000000000001',
    'a2300000-0000-4000-8000-000000000001',
    'Primeiro habito',
    'primeiro-habito',
    'Concluir o primeiro habito do ciclo.',
    'sparkles',
    0,
    '{"type": "first_habit"}'::jsonb,
    true,
    10
  ),
  (
    'a2300000-0000-4000-8003-000000000002',
    'a2300000-0000-4000-8000-000000000001',
    'Primeiro dia',
    'primeiro-dia',
    'Finalizar o primeiro dia do ciclo.',
    'sunrise',
    0,
    '{"type": "first_day"}'::jsonb,
    true,
    20
  ),
  (
    'a2300000-0000-4000-8003-000000000003',
    'a2300000-0000-4000-8000-000000000001',
    'Tres dias seguidos',
    'tres-dias-seguidos',
    'Manter tres dias validos em sequencia.',
    'flame',
    0,
    '{"type": "streak", "days": 3}'::jsonb,
    true,
    30
  ),
  (
    'a2300000-0000-4000-8003-000000000004',
    'a2300000-0000-4000-8000-000000000001',
    'Primeira semana',
    'primeira-semana',
    'Finalizar sete dias do ciclo.',
    'calendar-check',
    0,
    '{"type": "finalized_days", "days": 7}'::jsonb,
    true,
    40
  ),
  (
    'a2300000-0000-4000-8003-000000000005',
    'a2300000-0000-4000-8000-000000000001',
    'Sete leituras',
    'sete-leituras',
    'Concluir sete leituras no ciclo.',
    'book-open',
    0,
    '{"type": "reading_completions", "count": 7}'::jsonb,
    true,
    50
  ),
  (
    'a2300000-0000-4000-8003-000000000006',
    'a2300000-0000-4000-8000-000000000001',
    'Sete atividades fisicas',
    'sete-atividades-fisicas',
    'Concluir sete atividades fisicas no ciclo.',
    'activity',
    0,
    '{"type": "physical_activity_completions", "count": 7}'::jsonb,
    true,
    60
  ),
  (
    'a2300000-0000-4000-8003-000000000007',
    'a2300000-0000-4000-8000-000000000001',
    'Sete reflexoes',
    'sete-reflexoes',
    'Registrar sete reflexoes.',
    'pen-line',
    0,
    '{"type": "reflection_days", "count": 7}'::jsonb,
    true,
    70
  ),
  (
    'a2300000-0000-4000-8003-000000000008',
    'a2300000-0000-4000-8000-000000000001',
    'Metade do caminho',
    'metade-do-caminho',
    'Finalizar metade da duracao configurada.',
    'route',
    0,
    '{"type": "halfway"}'::jsonb,
    true,
    80
  ),
  (
    'a2300000-0000-4000-8003-000000000009',
    'a2300000-0000-4000-8000-000000000001',
    'Retorno forte',
    'retorno-forte',
    'Voltar com um dia valido depois de perder o ritmo.',
    'rotate-ccw',
    0,
    '{"type": "return_after_break"}'::jsonb,
    true,
    90
  ),
  (
    'a2300000-0000-4000-8003-000000000010',
    'a2300000-0000-4000-8000-000000000001',
    'Missao concluida',
    'missao-concluida',
    'Finalizar a duracao configurada do ciclo.',
    'trophy',
    0,
    '{"type": "challenge_completed"}'::jsonb,
    true,
    100
  )
on conflict (challenge_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  points_bonus = excluded.points_bonus,
  rule_config = excluded.rule_config,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

commit;

select
  'internal_validation_challenge_ready' as result,
  c.id,
  c.slug,
  c.status,
  c.duration_days,
  c.start_date,
  c.end_date,
  c.enrollment_start,
  c.enrollment_end
from public.challenges c
where c.slug = 'projeto-30-validacao-interna';

-- Verification queries for operators:
-- select count(*) from public.challenges where slug = 'projeto-30-validacao-interna';
-- select count(*) from public.challenge_days where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- select count(*) from public.habits where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- select count(*) from public.challenge_day_habits where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- select count(*) from public.achievements where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- select sum(points) from public.habits where challenge_id = 'a2300000-0000-4000-8000-000000000001';
--
-- Non-destructive cleanup option:
-- update public.challenges
-- set status = 'archived',
--     deleted_at = coalesce(deleted_at, now()),
--     updated_at = now()
-- where id = 'a2300000-0000-4000-8000-000000000001';
--
-- Destructive cleanup procedure, intentionally commented out.
-- Requires explicit approval before use. Auth users are not removed here.
-- begin;
-- delete from public.user_achievements where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.point_events where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.journal_entries
-- where enrollment_id in (
--   select id from public.challenge_enrollments
--   where challenge_id = 'a2300000-0000-4000-8000-000000000001'
-- );
-- delete from public.habit_logs
-- where daily_log_id in (
--   select id from public.daily_logs
--   where challenge_id = 'a2300000-0000-4000-8000-000000000001'
-- );
-- delete from public.daily_logs where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.challenge_enrollments where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.challenge_day_habits where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.achievements where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.habits where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.challenge_days where challenge_id = 'a2300000-0000-4000-8000-000000000001';
-- delete from public.challenges where id = 'a2300000-0000-4000-8000-000000000001';
-- commit;
