-- Padronizacao de desafios (parte 1/2 - schema e engine).
--
-- 1. Corrige a leitura de habitos de desafios encerrados (mesmo problema ja
--    resolvido para a tabela challenges em 0008, agora replicado para habits).
-- 2. Adiciona suporte minimo a capa de desafio (cover_image_url + bucket).
-- 3. Adiciona frequencia de habito (daily/weekly/monthly) e ajusta o motor
--    (journey_recalculate_daily_log) para nao cobrar habitos semanais/mensais
--    como parte da conclusao diaria - exatamente o problema descrito para
--    "Musculacao 4x/semana" e "Ler um livro" (mensal).
--
-- Nao altera: pontuacao por habito concluido (point_events continua
-- premiando cada conclusao, independente da frequencia), streak, RLS de
-- escrita administrativa, join_specific_challenge(), indice de inscricao
-- unica.

-- 1) Habitos de desafios encerrados / em que o usuario tem ou teve inscricao
-- (mesmo padrao ja usado em challenges na migration 0008).
create policy "Authenticated users can read habits of ended challenges"
  on public.habits for select
  to authenticated
  using (
    exists (
      select 1 from public.challenges c
      where c.id = habits.challenge_id
        and c.status = 'ended'
        and c.deleted_at is null
    )
  );

create policy "Users can read habits of challenges they are enrolled in"
  on public.habits for select
  to authenticated
  using (
    exists (
      select 1
      from public.challenge_enrollments ce
      where ce.challenge_id = habits.challenge_id
        and ce.user_id = auth.uid()
    )
  );

-- 2) Capa do desafio - campo generico, reutilizavel por qualquer desafio.
alter table public.challenges
  add column if not exists cover_image_url text;

-- Bucket proprio para capas (nao reaproveita "avatars"). Leitura publica
-- (capas aparecem no catalogo para qualquer visitante); escrita restrita a
-- admin/super_admin via public.is_admin(), nunca ao dono de uma "pasta"
-- como em avatars, porque aqui quem publica e a administracao, nao o
-- proprio usuario.
insert into storage.buckets (id, name, public)
values ('challenge-covers', 'challenge-covers', true)
on conflict (id) do nothing;

create policy "Challenge covers are publicly readable"
  on storage.objects for select
  using (bucket_id = 'challenge-covers');

create policy "Admins can manage challenge covers"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'challenge-covers' and public.is_admin())
  with check (bucket_id = 'challenge-covers' and public.is_admin());

-- 3) Frequencia do habito. Apenas os 3 valores realmente necessarios hoje
-- (o desafio de agosto so usa esses 3); a lista pode crescer em uma
-- migration futura se um novo desafio precisar de "specific_days" ou "once".
do $$
begin
  create type public.habit_frequency_type as enum ('daily', 'weekly', 'monthly');
exception when duplicate_object then null;
end $$;

alter table public.habits
  add column if not exists frequency_type public.habit_frequency_type not null default 'daily';

comment on column public.habits.frequency_type is
  'Como a meta do habito se acumula: daily = todo dia; weekly = meta acumulada '
  'na semana corrente (segunda a domingo, fuso do usuario); monthly = meta '
  'acumulada no mes corrente. So habitos daily entram no completion_percent '
  'do dia (ver journey_recalculate_daily_log).';

comment on column public.challenges.cover_image_url is
  'URL publica no bucket challenge-covers (challenges/{challengeId}/cover.<ext>). '
  'Nulo = catalogo usa o gradiente de marca como fallback visual.';

-- Motor: completion_percent do dia passa a considerar somente habitos
-- daily. Habitos weekly/monthly continuam registraveis em qualquer dia
-- (via update_habit_log, sem mudanca nele) e continuam gerando pontos por
-- conclusao em finalize_daily_log (sem mudanca la), mas nao entram no
-- denominador/numerador da conclusao diaria - por isso um habito semanal ou
-- mensal ainda incompleto nunca reduz o "dia completo" nem bloqueia o bonus
-- de "todos os habitos concluidos".
create or replace function public.journey_recalculate_daily_log(
  target_daily_log_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  applicable_habits integer := 0;
  completed_habits integer := 0;
  computed_completion_percent numeric(5, 2) := 0;
begin
  select
    count(*) filter (
      where coalesce(hl.status, 'pending'::public.habit_log_status) <> 'not_applicable'
    ),
    count(*) filter (where hl.status = 'completed')
  into applicable_habits, completed_habits
  from public.daily_logs dl
  join public.challenge_day_habits cdh on cdh.challenge_day_id = dl.challenge_day_id
  join public.habits h on h.id = cdh.habit_id
  left join public.habit_logs hl
    on hl.daily_log_id = dl.id
    and hl.habit_id = cdh.habit_id
  where dl.id = target_daily_log_id
    and h.frequency_type = 'daily';

  computed_completion_percent := case
    when applicable_habits = 0 then 100
    else round((completed_habits::numeric / applicable_habits::numeric) * 100, 2)
  end;

  update public.daily_logs
  set completion_percent = computed_completion_percent
  where id = target_daily_log_id;

  return jsonb_build_object(
    'applicable_habits', applicable_habits,
    'completed_habits', completed_habits,
    'completion_percent', computed_completion_percent
  );
end;
$$;

revoke execute on function public.journey_recalculate_daily_log(uuid)
  from public, anon, authenticated;
