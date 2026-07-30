-- Rodada de validacao ao vivo da migration 0019: normalizacao segura para
-- inscricoes que ficaram com personal_start_date/current_day/daily_logs
-- calculados ANTES de challenges.start_date existir como regra (ou seja,
-- criados antes da migration 0019 existir).
--
-- ACHADO (auditoria read-only, dado real): 2 enrollments no "Desafio de
-- Agosto - Irreconhecivel" (start_date = 2026-08-01) tinham
-- personal_start_date anterior a essa data - consequencia direta da lacuna
-- corrigida em 0019 (enrollment_start aberto antes de start_date). Uma delas
-- (conta QA) nao tinha nenhum daily_log/habit_log/point_event/achievement
-- associado - so o enrollment com current_day desatualizado. A outra (conta
-- admin de testes) tinha 2 daily_logs reais, ambos 'in_progress' (nunca
-- finalizados), 0 pontos, 0% de conclusao, sem habit_logs nem conquistas.
--
-- Sem essa normalizacao, no dia 01/08 o calculo (local_date - personal_start_date + 1)
-- abriria essas inscricoes direto no Dia 3+ em vez do Dia 1 - o desafio
-- "comecaria no meio", contradizendo a regra de negocio.
--
-- CORRECAO: funcao admin-only, security definer, idempotente e auditavel -
-- normaliza UM enrollment por vez (nunca em lote/automatico), documentando
-- exatamente o que mudou. Nao e chamada automaticamente por nenhum
-- trigger/RPC de producao; existe para ser invocada explicitamente pelo
-- admin quando uma inscricao antecipada e identificada.
--
-- O que a funcao faz, na ordem:
--   1) Confere admin (admin_require_admin()).
--   2) Se a inscricao ja esta alinhada (sem start_date, ou
--      personal_start_date >= start_date), e um no-op idempotente.
--   3) Remove daily_logs com log_date anterior ao start_date oficial -
--      cascade nativo (0001) ja remove habit_logs/journal_entries/
--      point_events dependentes.
--   4) Remove user_achievements desta inscricao cujo metadata aponte para
--      um dos daily_logs removidos (nunca acha nenhum "achievement" alheio).
--   5) Recalcula completion_percent/streak_current/streak_best/points_total
--      a partir do que sobrou (mesma formula usada em finalize_daily_log).
--   6) Ajusta personal_start_date para greatest(personal_start_date, start_date)
--      e current_day para 1 (baseline de inscricao ainda nao aberta - mesmo
--      default usado na criacao de qualquer enrollment novo).
--
-- Nao altera nenhuma outra inscricao alem da informada. Nao altera
-- challenges.start_date/enrollment_start/enrollment_end. Nao remove a
-- inscricao em si, nem qualquer dado de outros usuarios.

create or replace function public.admin_normalize_early_enrollment(
  p_enrollment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enrollment record;
  v_old_personal_start_date date;
  v_old_current_day integer;
  v_removed_daily_logs integer := 0;
  v_removed_achievements integer := 0;
  v_new_completion_percent numeric(5, 2) := 0;
  v_new_points_total integer := 0;
  v_streak_current integer := 0;
  v_streak_best integer := 0;
  v_finalized_count integer := 0;
  v_early_log_ids uuid[];
  streak_expected_date date;
  streak_record record;
begin
  perform public.admin_require_admin();

  select ce.id, ce.personal_start_date, ce.current_day, ce.streak_best,
         c.duration_days as duration_days_challenge, c.start_date
  into v_enrollment
  from public.challenge_enrollments ce
  join public.challenges c on c.id = ce.challenge_id
  where ce.id = p_enrollment_id
  for update of ce;

  if v_enrollment.id is null then
    raise exception 'Inscricao nao encontrada.'
      using errcode = 'P0002';
  end if;

  if v_enrollment.start_date is null or v_enrollment.personal_start_date >= v_enrollment.start_date then
    return jsonb_build_object(
      'enrollment_id', p_enrollment_id,
      'normalized', false,
      'reason', 'already_aligned'
    );
  end if;

  v_old_personal_start_date := v_enrollment.personal_start_date;
  v_old_current_day := v_enrollment.current_day;

  select array_agg(id) into v_early_log_ids
  from public.daily_logs
  where enrollment_id = p_enrollment_id
    and log_date < v_enrollment.start_date;

  if v_early_log_ids is not null then
    delete from public.user_achievements
    where enrollment_id = p_enrollment_id
      and (metadata ->> 'daily_log_id')::uuid = any (v_early_log_ids);
    get diagnostics v_removed_achievements = row_count;

    delete from public.daily_logs
    where id = any (v_early_log_ids);
    get diagnostics v_removed_daily_logs = row_count;
  end if;

  select coalesce(sum(points), 0)
  into v_new_points_total
  from public.point_events
  where enrollment_id = p_enrollment_id;

  select count(*)
  into v_finalized_count
  from public.daily_logs
  where enrollment_id = p_enrollment_id
    and status = 'finalized';

  v_new_completion_percent := least(
    100,
    round((v_finalized_count::numeric / v_enrollment.duration_days_challenge::numeric) * 100, 2)
  );

  streak_expected_date := null;
  v_streak_current := 0;

  for streak_record in
    select dl.log_date, dl.completion_percent
    from public.daily_logs dl
    where dl.enrollment_id = p_enrollment_id
      and dl.status = 'finalized'
    order by dl.log_date desc
  loop
    if streak_expected_date is null then
      streak_expected_date := streak_record.log_date;
    end if;

    if streak_record.log_date <> streak_expected_date then
      exit;
    end if;

    if streak_record.completion_percent < 70 then
      exit;
    end if;

    v_streak_current := v_streak_current + 1;
    streak_expected_date := streak_expected_date - 1;
  end loop;

  v_streak_best := greatest(v_enrollment.streak_best, v_streak_current);

  update public.challenge_enrollments
  set personal_start_date = v_enrollment.start_date,
      current_day = 1,
      completion_percent = v_new_completion_percent,
      points_total = v_new_points_total,
      streak_current = v_streak_current,
      streak_best = v_streak_best
  where id = p_enrollment_id;

  return jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'normalized', true,
    'old_personal_start_date', v_old_personal_start_date,
    'new_personal_start_date', v_enrollment.start_date,
    'old_current_day', v_old_current_day,
    'new_current_day', 1,
    'removed_daily_logs', v_removed_daily_logs,
    'removed_achievements', v_removed_achievements,
    'new_completion_percent', v_new_completion_percent,
    'new_points_total', v_new_points_total,
    'new_streak_current', v_streak_current,
    'new_streak_best', v_streak_best
  );
end;
$$;

comment on function public.admin_normalize_early_enrollment(uuid) is
  'Admin-only. Normaliza UMA inscricao cujo personal_start_date ficou '
  'anterior a challenges.start_date (lacuna corrigida em 0019): remove '
  'daily_logs/dependentes anteriores ao inicio oficial, recalcula '
  'completion_percent/streak/pontos, e ajusta personal_start_date/current_day '
  'para o baseline de inscricao ainda nao aberta. Idempotente - chamar de '
  'novo apos normalizado retorna normalized=false. Nunca roda em lote.';

revoke all on function public.admin_normalize_early_enrollment(uuid) from public, anon;
grant execute on function public.admin_normalize_early_enrollment(uuid) to authenticated;
