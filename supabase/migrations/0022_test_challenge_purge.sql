-- Fase: exclusao segura de desafios + purge de desafio de teste.
--
-- AUDITORIA (antes de qualquer alteracao)
-- O menu "..." do Admin ja existia (rodada anterior), mas o botao "Excluir"
-- so aparecia quando `status === 'draft'` (ChallengeRowActions.tsx), mesmo
-- quando o desafio real regra de negocio (zero participantes) permitia a
-- exclusao em qualquer status. Esse era um bug de UI (condicao a mais no
-- componente client), nao um problema de schema/RLS/deployment - a action
-- deleteChallengeAction e a protecao por FK (challenge_enrollments.challenge_id
-- on delete restrict) ja funcionavam corretamente e continuam inalteradas.
-- A correcao do componente esta no mesmo commit desta migration.
--
-- "Projeto 30 - Validacao Interna" (slug projeto-30-validacao-interna) e o
-- desafio interno usado para testar a propria plataforma. Auditoria completa
-- (read-only, antes de qualquer purge):
--   - 1 enrollment, pertencente ao proprio super_admin (Silas), status
--     abandoned, 0 pontos.
--   - 2 daily_logs, 5 habit_logs, 0 journal_entries, 0 point_events,
--     0 user_achievements (ganhas), 10 achievements (definicoes, nunca
--     ganhas), 0 share_cards, 2 analytics_events, 7 challenge_days,
--     5 habits, 35 challenge_day_habits.
--   - Nenhum outro usuario real (QA ou qualquer outro) tem qualquer vinculo
--     com este desafio. Confirmado com o "Desafio de Agosto" intacto e
--     nao afetado por qualquer alteracao desta migration.
-- Como ele tem historico (a propria conta do admin usando a plataforma),
-- a regra global de "nao excluir desafio com participantes/historico"
-- continua valendo para qualquer outro desafio - por isso esta migration
-- cria um mecanismo de purge SEPARADO, explicito, e restrito a
-- (a) super_admin e (b) desafios marcados individualmente como is_test.

-- 1) Marcador explicito de dado de teste. Boolean simples e suficiente -
-- nao ha campo category/metadata generico em public.challenges hoje que
-- sirva para isso sem sobrecarregar seu significado.
alter table public.challenges
  add column if not exists is_test boolean not null default false;

comment on column public.challenges.is_test is
  'Marca um desafio como dado interno de teste/validacao, nunca um desafio '
  'real de usuarios. So um desafio marcado is_test = true pode ser alvo de '
  'admin_delete_test_challenge_permanently() mesmo tendo historico. Nunca '
  'marcar um desafio real apenas por estar arquivado.';

-- Marca apenas o desafio de teste identificado na auditoria acima. Nenhum
-- outro desafio (incluindo o Desafio de Agosto) e tocado por este update.
update public.challenges
set is_test = true
where slug = 'projeto-30-validacao-interna';

-- 2) Helper de autorizacao super_admin, mesmo padrao de admin_require_admin()
-- (0006_admin_analytics.sql): security definer, valida o papel, lanca
-- excecao (nunca devolve false silenciosamente para quem chama).
create or replace function public.admin_require_super_admin()
returns public.user_role
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_role public.user_role;
begin
  v_current_role := public.current_user_role();

  if v_current_role <> 'super_admin' then
    raise exception 'Apenas super_admin pode executar esta acao.'
      using errcode = '42501';
  end if;

  return v_current_role;
end;
$$;

revoke execute on function public.admin_require_super_admin() from public, anon, authenticated;
grant execute on function public.admin_require_super_admin() to authenticated;

-- 3) RPC de purge. Remove um desafio de teste e TODAS as suas dependencias
-- em uma unica transacao (a propria execucao da funcao), na ordem exigida
-- pelas FKs "on delete restrict" do schema (daily_logs -> challenge_days;
-- habit_logs -> challenge_day_habits; challenge_enrollments -> challenges):
-- filhos restritos sempre removidos antes do pai que os restringe. Nunca
-- aceita um challenge_id arbitrario sem validar is_test = true, nome e
-- frase de confirmacao exatos - bloqueando por design o uso desta funcao
-- contra qualquer desafio real, mesmo que arquivado.
create or replace function public.admin_delete_test_challenge_permanently(
  target_challenge_id uuid,
  confirmation_name text,
  confirmation_phrase text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.challenges%rowtype;
  v_enrollment_count integer;
  v_daily_log_count integer;
  v_habit_log_count integer;
  v_journal_count integer;
  v_point_event_count integer;
  v_achievement_definition_count integer;
  v_achievement_count integer;
  v_share_card_count integer;
  v_analytics_count integer;
  v_day_count integer;
  v_habit_count integer;
  v_day_habit_count integer;
  v_removed jsonb;
begin
  perform public.admin_require_super_admin();

  if confirmation_phrase is distinct from 'EXCLUIR PERMANENTEMENTE' then
    raise exception 'Frase de confirmacao incorreta.' using errcode = 'P0002';
  end if;

  -- Trava a linha do desafio contra alteracoes concorrentes ate o fim desta
  -- transacao (evita corrida entre a contagem de participantes exibida no
  -- Admin e a execucao real do purge).
  select * into v_challenge
  from public.challenges
  where id = target_challenge_id
  for update;

  if not found then
    raise exception 'Desafio nao encontrado.' using errcode = 'P0002';
  end if;

  if v_challenge.is_test is not true then
    raise exception
      'Este desafio nao esta marcado como desafio de teste - purge bloqueado.'
      using errcode = 'P0003';
  end if;

  if v_challenge.name is distinct from confirmation_name then
    raise exception 'Nome do desafio nao confere.' using errcode = 'P0002';
  end if;

  select count(*) into v_enrollment_count
    from public.challenge_enrollments where challenge_id = target_challenge_id;
  select count(*) into v_daily_log_count
    from public.daily_logs where challenge_id = target_challenge_id;
  select count(*) into v_habit_log_count
    from public.habit_logs hl
    join public.daily_logs dl on dl.id = hl.daily_log_id
    where dl.challenge_id = target_challenge_id;
  select count(*) into v_journal_count
    from public.journal_entries je
    where je.enrollment_id in (
      select id from public.challenge_enrollments where challenge_id = target_challenge_id
    );
  select count(*) into v_point_event_count
    from public.point_events where challenge_id = target_challenge_id;
  select count(*) into v_achievement_count
    from public.user_achievements where challenge_id = target_challenge_id;
  select count(*) into v_achievement_definition_count
    from public.achievements where challenge_id = target_challenge_id;
  select count(*) into v_share_card_count
    from public.share_cards where challenge_id = target_challenge_id;
  select count(*) into v_analytics_count
    from public.analytics_events where challenge_id = target_challenge_id;
  select count(*) into v_day_count
    from public.challenge_days where challenge_id = target_challenge_id;
  select count(*) into v_habit_count
    from public.habits where challenge_id = target_challenge_id;
  select count(*) into v_day_habit_count
    from public.challenge_day_habits where challenge_id = target_challenge_id;

  -- Ordem: filhos restritos antes do pai que os restringe.
  delete from public.analytics_events where challenge_id = target_challenge_id;
  delete from public.share_cards where challenge_id = target_challenge_id;
  delete from public.user_achievements where challenge_id = target_challenge_id;
  delete from public.point_events where challenge_id = target_challenge_id;
  delete from public.journal_entries
    where enrollment_id in (
      select id from public.challenge_enrollments where challenge_id = target_challenge_id
    );
  delete from public.habit_logs
    where daily_log_id in (
      select id from public.daily_logs where challenge_id = target_challenge_id
    );
  delete from public.daily_logs where challenge_id = target_challenge_id;
  delete from public.challenge_enrollments where challenge_id = target_challenge_id;
  delete from public.challenge_day_habits where challenge_id = target_challenge_id;
  delete from public.challenge_days where challenge_id = target_challenge_id;
  delete from public.habits where challenge_id = target_challenge_id;
  delete from public.achievements where challenge_id = target_challenge_id;
  delete from public.challenges where id = target_challenge_id;

  v_removed := jsonb_build_object(
    'enrollments', v_enrollment_count,
    'daily_logs', v_daily_log_count,
    'habit_logs', v_habit_log_count,
    'journal_entries', v_journal_count,
    'point_events', v_point_event_count,
    'user_achievements', v_achievement_count,
    'achievement_definitions', v_achievement_definition_count,
    'share_cards', v_share_card_count,
    'analytics_events', v_analytics_count,
    'challenge_days', v_day_count,
    'habits', v_habit_count,
    'challenge_day_habits', v_day_habit_count
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, entity_type, entity_id, before_json, after_json
  )
  values (
    auth.uid(),
    'admin_delete_test_challenge_permanently',
    'challenge',
    target_challenge_id,
    to_jsonb(v_challenge),
    v_removed
  );

  return jsonb_build_object(
    'challenge_id', target_challenge_id,
    'challenge_name', v_challenge.name,
    'removed', v_removed
  );
end;
$$;

revoke execute on function public.admin_delete_test_challenge_permanently(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_delete_test_challenge_permanently(uuid, text, text)
  to authenticated;

-- 4) Preview somente-leitura das mesmas contagens, para o modal do Admin
-- mostrar "o que vai ser removido" ANTES de confirmar (nunca calculado no
-- cliente a partir de dados que o cliente ja tem em cache).
create or replace function public.admin_test_challenge_purge_preview(
  target_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_challenge public.challenges%rowtype;
begin
  perform public.admin_require_super_admin();

  select * into v_challenge from public.challenges where id = target_challenge_id;

  if not found then
    raise exception 'Desafio nao encontrado.' using errcode = 'P0002';
  end if;

  if v_challenge.is_test is not true then
    raise exception
      'Este desafio nao esta marcado como desafio de teste.' using errcode = 'P0003';
  end if;

  return jsonb_build_object(
    'challenge_id', v_challenge.id,
    'challenge_name', v_challenge.name,
    'counts', jsonb_build_object(
      'enrollments', (
        select count(*) from public.challenge_enrollments where challenge_id = target_challenge_id
      ),
      'daily_logs', (
        select count(*) from public.daily_logs where challenge_id = target_challenge_id
      ),
      'habit_logs', (
        select count(*) from public.habit_logs hl
        join public.daily_logs dl on dl.id = hl.daily_log_id
        where dl.challenge_id = target_challenge_id
      ),
      'journal_entries', (
        select count(*) from public.journal_entries je
        where je.enrollment_id in (
          select id from public.challenge_enrollments where challenge_id = target_challenge_id
        )
      ),
      'point_events', (
        select count(*) from public.point_events where challenge_id = target_challenge_id
      ),
      'analytics_events', (
        select count(*) from public.analytics_events where challenge_id = target_challenge_id
      )
    )
  );
end;
$$;

revoke execute on function public.admin_test_challenge_purge_preview(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_test_challenge_purge_preview(uuid)
  to authenticated;

-- 5) admin_list_challenges precisa devolver is_test para o Admin decidir
-- quando oferecer "Excluir permanentemente". Mudar o retorno de uma funcao
-- exige DROP + CREATE (CREATE OR REPLACE nao permite alterar o tipo de
-- retorno) - corpo reproduzido de 0006_admin_analytics.sql na integra, com
-- a unica mudanca sendo a coluna is_test adicionada.
drop function if exists public.admin_list_challenges(
  text, public.challenge_status, text, text, integer, integer
);

create function public.admin_list_challenges(
  p_search text default null,
  p_status public.challenge_status default null,
  p_sort_by text default 'created_at',
  p_sort_dir text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  status public.challenge_status,
  is_test boolean,
  start_date date,
  end_date date,
  duration_days integer,
  created_at timestamptz,
  participant_count bigint,
  average_progress numeric,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sort_by text := lower(coalesce(p_sort_by, 'created_at'));
  v_sort_dir text := lower(coalesce(p_sort_dir, 'desc'));
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.admin_require_admin();

  if v_sort_by not in ('created_at', 'participant_count', 'average_progress', 'name') then
    v_sort_by := 'created_at';
  end if;

  if v_sort_dir not in ('asc', 'desc') then
    v_sort_dir := 'desc';
  end if;

  return query execute format(
    $q$
      select
        c.id,
        c.name,
        c.slug,
        c.status,
        c.is_test,
        c.start_date,
        c.end_date,
        c.duration_days,
        c.created_at,
        coalesce(stats.participant_count, 0) as participant_count,
        coalesce(stats.average_progress, 0) as average_progress,
        count(*) over() as total_count
      from public.challenges c
      left join lateral (
        select
          count(*) as participant_count,
          round(avg(ce.completion_percent), 2) as average_progress
        from public.challenge_enrollments ce
        where ce.challenge_id = c.id
      ) stats on true
      where c.deleted_at is null
        and ($1 is null or c.status = $1)
        and (
          $2 is null
          or c.name ilike '%%' || $2 || '%%'
          or c.slug ilike '%%' || $2 || '%%'
        )
      order by %I %s nulls last, c.id asc
      limit $3
      offset $4
    $q$,
    v_sort_by,
    v_sort_dir
  )
  using p_status, nullif(trim(coalesce(p_search, '')), ''), v_limit, v_offset;
end;
$$;

revoke execute on function public.admin_list_challenges(
  text, public.challenge_status, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.admin_list_challenges(
  text, public.challenge_status, text, text, integer, integer
) to authenticated;
