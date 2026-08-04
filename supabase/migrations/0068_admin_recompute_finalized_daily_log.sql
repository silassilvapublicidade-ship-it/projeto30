-- Correcao pontual de historico (conta do Silas) - Parte 1.
--
-- PEDIDO: marcar habitos diarios aplicaveis como concluidos em dias JA
-- finalizados de UMA inscricao, e recalcular tudo (percentual, pontos,
-- streak, conquistas) por funcoes oficiais - nunca por UPDATE manual em
-- streak_current/streak_best/completion_percent/points.
--
-- AUDITORIA (antes de escrever qualquer SQL): nenhuma funcao oficial hoje
-- permite isso.
--   - update_habit_log(): `if daily_record.status = 'finalized' then raise
--     exception 'O dia ja foi finalizado.'` - bloqueia por design.
--   - finalize_daily_log_with_responses(): se o dia ja esta finalizado,
--     e um curto-circuito somente-leitura (retorna o estado ja gravado,
--     nunca reprocessa).
--   - journey_recalculate_daily_log(): so recalcula daily_logs.completion_percent
--     a partir de habit_logs - nunca toca pontos/streak/conquistas.
--   - Nao existe nenhuma funcao "recalcular streak"/"reconciliar pontos"/
--     "reavaliar conquistas" em todo o schema (varrido via pg_proc).
--
-- Ou seja: o sistema foi desenhado para finalizacao "de uma vez so" - nao
-- ha caminho oficial para reabrir um dia ja finalizado. Esta migration
-- ADICIONA esse caminho oficial, pedido explicitamente pelo usuario apos
-- confirmar a lacuna, reaproveitando (copiado, nunca reinventado) o EXATO
-- corpo de calculo ja usado em finalize_daily_log_with_responses (0050):
-- mesma formula de pontos por habito, mesmo bonus de "todos os habitos",
-- mesmo passo de reflexao, mesmo loop de streak (anda para tras a partir
-- da data do dia sendo reprocessado, exigindo completion_percent >= regra
-- de minimo), mesma lista/criterio de conquistas.
--
-- DIFERENCAS DELIBERADAS em relacao a finalize_daily_log_with_responses
-- (documentadas, nunca uma regra de calculo diferente):
--   1) Admin-only (admin_require_admin()) - nunca self-service. Reabrir um
--      dia finalizado e uma operacao de correcao de dado, nao uma acao
--      normal de usuario; deixa-la disponivel para qualquer usuario
--      permitiria inflar pontos/streak reabrindo dias repetidamente.
--   2) So marca 'completed' habitos de frequencia DIARIA, visiveis naquele
--      dia (habit_visible_on_day), que ainda nao estao 'completed' nem
--      'not_applicable' - nunca sobrescreve not_applicable, nunca toca
--      habito semanal/mensal (jorney_recalculate_daily_log so conta
--      frequencia diaria no percentual mesmo; e o loop de pontos do
--      finalize daria pontos a QUALQUER completed independente de
--      frequencia - tocar um habito semanal/mensal aqui inflaria pontos
--      indevidamente, exatamente o que "respeitar regras semanais e
--      mensais" pede para evitar).
--   3) Nunca toca a coluna note de habit_logs - comentarios existentes
--      ficam intactos.
--   4) Nunca dispara os eventos de analytics/notificacao que o finalize
--      original dispara (challenge_day_completed, challenge_day_7_reached,
--      challenge_halfway_reached, challenge_completed,
--      challenge_first_habit_completed) - esta e uma correcao de HISTORICO,
--      nao uma acao acontecendo agora; disparar esses eventos com o
--      timestamp de hoje forjaria quando cada marco realmente aconteceu e
--      poderia acionar notificacoes push por um evento que nao e novo.
--   5) So pode ser chamada para um daily_log que JA esta finalizado (o
--      caminho normal - update_habit_log + finalize_daily_log_with_responses -
--      continua sendo o unico usado para dias ainda em andamento).
--
-- Nenhuma regra de pontos, streak ou conquista muda - a formula e
-- byte-a-byte a mesma, so o gatilho (dia ja finalizado, admin-only) e novo.

create or replace function public.admin_recompute_finalized_daily_log(
  target_daily_log_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  daily_record record;
  updated_habit_ids uuid[] := array[]::uuid[];
  v_updated_habits_count integer := 0;
  progress jsonb;
  applicable_habits integer := 0;
  completed_habits integer := 0;
  completion_percent numeric(5, 2) := 0;
  reflection_points integer := 10;
  finalize_day_points integer := 10;
  all_habits_bonus_points integer := 30;
  streak_minimum_completion numeric(5, 2) := 70;
  journal_record public.journal_entries;
  journal_completed boolean := false;
  point_habit_record record;
  v_points_earned integer := 0;
  streak_count integer := 0;
  best_streak integer := 0;
  expected_date date;
  log_record record;
  finalized_days integer := 0;
  completed_habits_lifetime integer := 0;
  reading_completions integer := 0;
  physical_activity_completions integer := 0;
  reflection_days integer := 0;
  completed_cycle boolean := false;
  return_strong boolean := false;
  unlocked_achievements jsonb := '[]'::jsonb;
  achievement_record record;
  new_user_achievement_id uuid;
begin
  perform public.admin_require_admin();

  select
    dl.id,
    dl.enrollment_id,
    dl.challenge_id,
    dl.challenge_day_id,
    dl.log_date,
    dl.status,
    ce.user_id,
    ce.current_day,
    ce.streak_best,
    c.duration_days,
    c.rules_config,
    cd.day_number as challenge_day_number
  into daily_record
  from public.daily_logs dl
  join public.challenge_enrollments ce on ce.id = dl.enrollment_id
  join public.challenges c on c.id = dl.challenge_id
  join public.challenge_days cd on cd.id = dl.challenge_day_id
  where dl.id = target_daily_log_id
  for update of dl, ce;

  if daily_record.id is null then
    raise exception 'Registro diario nao encontrado.'
      using errcode = 'P0002';
  end if;

  if daily_record.status <> 'finalized'::public.daily_log_status then
    raise exception 'Este dia ainda nao foi finalizado - use o fluxo normal de habitos/finalizacao.'
      using errcode = '22023';
  end if;

  streak_minimum_completion := public.journey_rule_int(
    daily_record.rules_config, 'streak_minimum_completion', 70
  )::numeric(5, 2);

  -- 1) Marca 'completed' so os habitos diarios, visiveis, ainda pendentes -
  -- nunca not_applicable, nunca semanal/mensal, nunca mexe em note.
  with eligible as (
    select hl.id as habit_log_id, hl.habit_id, h.habit_type
    from public.habit_logs hl
    join public.habits h on h.id = hl.habit_id
    join public.challenge_day_habits cdh
      on cdh.habit_id = h.id and cdh.challenge_day_id = daily_record.challenge_day_id
    where hl.daily_log_id = daily_record.id
      and h.frequency_type = 'daily'::public.habit_frequency_type
      and h.active
      and hl.status not in ('completed'::public.habit_log_status, 'not_applicable'::public.habit_log_status)
      and public.habit_visible_on_day(h.visibility_config, daily_record.challenge_day_number, daily_record.duration_days)
  ),
  updated as (
    update public.habit_logs hl
    set status = 'completed'::public.habit_log_status,
        value_json = case
          when e.habit_type in ('quantity'::public.habit_type, 'duration'::public.habit_type)
            then jsonb_build_object('value', 1)
          else jsonb_build_object('completed', true)
        end,
        completed_at = now(),
        updated_at = now()
    from eligible e
    where hl.id = e.habit_log_id
    returning e.habit_id
  )
  select coalesce(array_agg(habit_id), array[]::uuid[]), count(*)
  into updated_habit_ids, v_updated_habits_count
  from updated;

  -- 2) Recalcula completion_percent pela funcao oficial (nunca reescrita aqui).
  progress := public.journey_recalculate_daily_log(daily_record.id);
  applicable_habits := (progress ->> 'applicable_habits')::integer;
  completed_habits := (progress ->> 'completed_habits')::integer;
  completion_percent := (progress ->> 'completion_percent')::numeric(5, 2);

  reflection_points := public.journey_rule_int(daily_record.rules_config, 'reflection_points', 10);
  finalize_day_points := public.journey_rule_int(daily_record.rules_config, 'finalize_day_points', 10);
  all_habits_bonus_points := public.journey_rule_int(daily_record.rules_config, 'all_habits_bonus_points', 30);

  select * into journal_record
  from public.journal_entries
  where daily_log_id = daily_record.id
  limit 1;

  if journal_record.id is not null then
    journal_completed := public.journey_has_journal_content(journal_record);
  end if;

  -- 3) point_events - mesma formula/mesma idempotency_key de
  -- finalize_daily_log_with_responses: linhas ja existentes (habitos que
  -- ja estavam completed) sao ignoradas via ON CONFLICT DO NOTHING; so os
  -- habitos recem-marcados geram linha nova.
  for point_habit_record in
    select h.id, coalesce(cdh.override_points, h.points) as points
    from public.challenge_day_habits cdh
    join public.habits h on h.id = cdh.habit_id
    join public.habit_logs hl on hl.habit_id = h.id and hl.daily_log_id = daily_record.id
    where cdh.challenge_day_id = daily_record.challenge_day_id
      and hl.status = 'completed'::public.habit_log_status
  loop
    insert into public.point_events (
      user_id, enrollment_id, challenge_id, daily_log_id, source_type, source_id, points, idempotency_key, metadata
    )
    values (
      daily_record.user_id, daily_record.enrollment_id, daily_record.challenge_id, daily_record.id,
      'habit', point_habit_record.id, point_habit_record.points,
      daily_record.enrollment_id || ':' || daily_record.id || ':habit:' || point_habit_record.id,
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end loop;

  if journal_completed and reflection_points > 0 then
    insert into public.point_events (
      user_id, enrollment_id, challenge_id, daily_log_id, source_type, source_id, points, idempotency_key, metadata
    )
    values (
      daily_record.user_id, daily_record.enrollment_id, daily_record.challenge_id, daily_record.id,
      'reflection', journal_record.id, reflection_points,
      daily_record.enrollment_id || ':' || daily_record.id || ':reflection',
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if finalize_day_points > 0 then
    insert into public.point_events (
      user_id, enrollment_id, challenge_id, daily_log_id, source_type, source_id, points, idempotency_key, metadata
    )
    values (
      daily_record.user_id, daily_record.enrollment_id, daily_record.challenge_id, daily_record.id,
      'day_finalized', daily_record.id, finalize_day_points,
      daily_record.enrollment_id || ':' || daily_record.id || ':day-finalized',
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if applicable_habits > 0 and completed_habits = applicable_habits and all_habits_bonus_points > 0 then
    insert into public.point_events (
      user_id, enrollment_id, challenge_id, daily_log_id, source_type, source_id, points, idempotency_key, metadata
    )
    values (
      daily_record.user_id, daily_record.enrollment_id, daily_record.challenge_id, daily_record.id,
      'all_habits_completed', daily_record.id, all_habits_bonus_points,
      daily_record.enrollment_id || ':' || daily_record.id || ':all-habits',
      jsonb_build_object('day_number', daily_record.current_day)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  update public.daily_logs
  set points_earned = (select coalesce(sum(points), 0) from public.point_events where daily_log_id = daily_record.id)
  where id = daily_record.id
  returning points_earned into v_points_earned;

  -- 4) Streak - mesmo loop de finalize, ancorado na data DESTE dia (chamar
  -- em ordem cronologica ascendente para os dias reabertos faz o ultimo
  -- dia, o mais recente, prevalecer com o streak_current correto).
  expected_date := daily_record.log_date;
  streak_count := 0;

  for log_record in
    select dl.log_date, dl.completion_percent
    from public.daily_logs dl
    where dl.enrollment_id = daily_record.enrollment_id
      and dl.status = 'finalized'
      and dl.log_date <= daily_record.log_date
    order by dl.log_date desc
  loop
    if log_record.log_date <> expected_date then
      exit;
    end if;
    if log_record.completion_percent < streak_minimum_completion then
      exit;
    end if;
    streak_count := streak_count + 1;
    expected_date := expected_date - 1;
  end loop;

  best_streak := greatest(daily_record.streak_best, streak_count);

  select count(*) into finalized_days
  from public.daily_logs
  where enrollment_id = daily_record.enrollment_id and status = 'finalized';

  completed_cycle := finalized_days >= daily_record.duration_days;
  return_strong := completion_percent >= streak_minimum_completion
    and exists (
      select 1 from public.daily_logs previous_dl
      where previous_dl.enrollment_id = daily_record.enrollment_id
        and previous_dl.status = 'finalized'
        and previous_dl.log_date < daily_record.log_date
    )
    and not exists (
      select 1 from public.daily_logs previous_valid_dl
      where previous_valid_dl.enrollment_id = daily_record.enrollment_id
        and previous_valid_dl.status = 'finalized'
        and previous_valid_dl.log_date = daily_record.log_date - 1
        and previous_valid_dl.completion_percent >= streak_minimum_completion
    );

  update public.challenge_enrollments
  set points_total = (select coalesce(sum(points), 0) from public.point_events pe where pe.enrollment_id = daily_record.enrollment_id),
      streak_current = streak_count,
      streak_best = best_streak,
      completion_percent = least(100, round((finalized_days::numeric / daily_record.duration_days::numeric) * 100, 2)),
      status = case when completed_cycle then 'completed'::public.enrollment_status else status end,
      completed_at = case when completed_cycle then coalesce(completed_at, now()) else completed_at end
  where id = daily_record.enrollment_id;

  -- 5) Conquistas - mesmos criterios/mesma lista de finalize, idempotente
  -- via ON CONFLICT (user_id, enrollment_id, achievement_id) DO NOTHING.
  select count(*) into completed_habits_lifetime
  from public.habit_logs hl join public.daily_logs dl on dl.id = hl.daily_log_id
  where dl.enrollment_id = daily_record.enrollment_id and hl.status = 'completed';

  select count(*) into reading_completions
  from public.habit_logs hl join public.daily_logs dl on dl.id = hl.daily_log_id join public.habits h on h.id = hl.habit_id
  where dl.enrollment_id = daily_record.enrollment_id and hl.status = 'completed' and h.habit_type = 'reading';

  select count(*) into physical_activity_completions
  from public.habit_logs hl join public.daily_logs dl on dl.id = hl.daily_log_id join public.habits h on h.id = hl.habit_id
  where dl.enrollment_id = daily_record.enrollment_id and hl.status = 'completed'
    and (
      lower(coalesce(h.category, '')) in ('corpo', 'atividade fisica', 'atividade física', 'fisico', 'físico')
      or lower(coalesce(h.icon, '')) in ('activity', 'dumbbell', 'run', 'footprints')
    );

  select count(*) into reflection_days
  from public.journal_entries je join public.daily_logs dl on dl.id = je.daily_log_id
  where dl.enrollment_id = daily_record.enrollment_id and public.journey_has_journal_content(je);

  for achievement_record in
    select * from public.achievements a
    where a.challenge_id = daily_record.challenge_id and a.active
      and a.slug in (
        'primeiro-habito', 'primeiro-dia', 'tres-dias-seguidos', 'primeira-semana',
        'sete-leituras', 'sete-atividades-fisicas', 'sete-reflexoes',
        'metade-do-caminho', 'retorno-forte', 'missao-concluida'
      )
  loop
    if (
      (achievement_record.slug = 'primeiro-habito' and completed_habits_lifetime >= 1)
      or (achievement_record.slug = 'primeiro-dia' and finalized_days >= 1)
      or (achievement_record.slug = 'tres-dias-seguidos' and streak_count >= 3)
      or (achievement_record.slug = 'primeira-semana' and finalized_days >= 7)
      or (achievement_record.slug = 'sete-leituras' and reading_completions >= 7)
      or (achievement_record.slug = 'sete-atividades-fisicas' and physical_activity_completions >= 7)
      or (achievement_record.slug = 'sete-reflexoes' and reflection_days >= 7)
      or (achievement_record.slug = 'metade-do-caminho' and finalized_days >= ceil(daily_record.duration_days::numeric / 2))
      or (achievement_record.slug = 'retorno-forte' and return_strong)
      or (achievement_record.slug = 'missao-concluida' and completed_cycle)
    ) then
      new_user_achievement_id := null;

      insert into public.user_achievements (user_id, enrollment_id, challenge_id, achievement_id, metadata)
      values (
        daily_record.user_id, daily_record.enrollment_id, daily_record.challenge_id, achievement_record.id,
        jsonb_build_object('daily_log_id', daily_record.id, 'day_number', daily_record.current_day, 'completion_percent', completion_percent)
      )
      on conflict (user_id, enrollment_id, achievement_id) do nothing
      returning id into new_user_achievement_id;

      if found then
        unlocked_achievements := unlocked_achievements || jsonb_build_array(
          jsonb_build_object(
            'id', achievement_record.id, 'user_achievement_id', new_user_achievement_id,
            'name', achievement_record.name, 'slug', achievement_record.slug,
            'icon', achievement_record.icon, 'points_bonus', achievement_record.points_bonus
          )
        );

        if achievement_record.points_bonus > 0 then
          insert into public.point_events (
            user_id, enrollment_id, challenge_id, daily_log_id, source_type, source_id, points, idempotency_key, metadata
          )
          values (
            daily_record.user_id, daily_record.enrollment_id, daily_record.challenge_id, daily_record.id,
            'achievement', achievement_record.id, achievement_record.points_bonus,
            daily_record.enrollment_id || ':achievement:' || achievement_record.id,
            jsonb_build_object('daily_log_id', daily_record.id)
          )
          on conflict (idempotency_key) do nothing;
        end if;
      end if;
    end if;
  end loop;

  -- Pontos podem ter mudado de novo (bonus de conquista) - soma final.
  update public.daily_logs
  set points_earned = (select coalesce(sum(points), 0) from public.point_events where daily_log_id = daily_record.id)
  where id = daily_record.id
  returning points_earned into v_points_earned;

  update public.challenge_enrollments
  set points_total = (select coalesce(sum(points), 0) from public.point_events pe where pe.enrollment_id = daily_record.enrollment_id)
  where id = daily_record.enrollment_id;

  return jsonb_build_object(
    'daily_log_id', daily_record.id,
    'log_date', daily_record.log_date,
    'updated_habit_ids', to_jsonb(updated_habit_ids),
    'updated_habits_count', v_updated_habits_count,
    'applicable_habits', applicable_habits,
    'completed_habits', completed_habits,
    'completion_percent', completion_percent,
    'points_earned', v_points_earned,
    'streak_current', streak_count,
    'streak_best', best_streak,
    'unlocked_achievements', unlocked_achievements
  );
end;
$$;

revoke all on function public.admin_recompute_finalized_daily_log(uuid) from public, anon;
grant execute on function public.admin_recompute_finalized_daily_log(uuid) to authenticated;

comment on function public.admin_recompute_finalized_daily_log(uuid) is
  'Admin-only. Reabre UM daily_log ja finalizado: marca completed os '
  'habitos DIARIOS visiveis ainda pendentes (nunca not_applicable, nunca '
  'semanal/mensal, nunca mexe em note), recalcula completion_percent via '
  'journey_recalculate_daily_log, reaproveita a formula EXATA de pontos/'
  'streak/conquistas de finalize_daily_log_with_responses (idempotente via '
  'idempotency_key / unique constraint - nunca duplica o que ja existia). '
  'Nunca dispara analytics/notificacoes (correcao de historico, nao uma '
  'acao acontecendo agora). Chamar em ordem cronologica ascendente quando '
  'reabrindo varios dias da mesma inscricao, para o streak convergir '
  'corretamente no dia mais recente.';
