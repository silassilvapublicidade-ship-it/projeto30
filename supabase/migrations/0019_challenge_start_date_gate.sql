-- Rodada de correcoes funcionais: bloqueia execucao de um desafio antes da
-- sua data oficial de inicio (challenges.start_date).
--
-- PROBLEMA ENCONTRADO (confirmado com dado real em producao, leitura
-- somente-consulta): o "Desafio de Agosto - Irreconhecivel" tem
-- start_date = 2026-08-01, mas enrollment_start = 2026-07-28 (janela de
-- INSCRICAO aberta antes do inicio oficial, decisao de produto valida).
-- Nenhuma RPC de jornada jamais verificou start_date - apenas
-- enrollment_start/enrollment_end (janela de inscricao) e
-- personal_start_date (data em que CADA usuario se inscreveu, sempre =
-- data local no momento do join). Resultado real observado: a inscricao
-- de QA em Agosto ja tinha current_day = 2 no dia 29/07, um dia antes do
-- inicio oficial do desafio.
--
-- CORRECAO: ensure_today_daily_log (unico ponto que cria daily_logs, e
-- portanto o unico portao real de execucao - update_habit_log/
-- finalize_daily_log so operam sobre um daily_log ja existente) passa a
-- verificar challenges.start_date. Se a data local do usuario ainda nao
-- alcancou start_date, a funcao recusa abrir o dia com o novo codigo de
-- erro 'P0005', sem criar daily_log, sem pontos, sem streak, sem
-- conquistas. A inscricao em si continua permitida antes do inicio (regra
-- de produto explicita), so a EXECUCAO fica bloqueada.
--
-- Nao altera nenhuma outra regra de journey_calculate_day/
-- journey_get_local_date (permanecem como estavam). Nao toca em
-- join_specific_challenge/join_available_challenge (a inscricao antecipada
-- continua permitida quando enrollment_start permitir).

create or replace function public.ensure_today_daily_log(
  target_enrollment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  enrollment_record record;
  local_date date;
  calculated_day integer;
  selected_challenge_day_id uuid;
  daily_log_id uuid;
begin
  if actor_id is null then
    raise exception 'Sessao necessaria para abrir o dia.'
      using errcode = '42501';
  end if;

  select
    ce.id, ce.challenge_id, ce.personal_start_date, ce.status,
    c.duration_days, c.rules_config, c.status as challenge_status,
    c.start_date, u.timezone
  into enrollment_record
  from public.challenge_enrollments ce
  join public.challenges c on c.id = ce.challenge_id
  join public.users u on u.id = ce.user_id
  where ce.user_id = actor_id
    and ce.status = 'active'
    and c.status = 'active'
    and c.deleted_at is null
    and (target_enrollment_id is null or ce.id = target_enrollment_id)
  order by ce.joined_at desc
  limit 1
  for update of ce;

  if enrollment_record.id is null then
    raise exception 'Nenhuma inscricao ativa encontrada.'
      using errcode = 'P0002';
  end if;

  local_date := public.journey_get_local_date(enrollment_record.timezone);

  if enrollment_record.start_date is not null and local_date < enrollment_record.start_date then
    raise exception 'Este desafio ainda nao comecou oficialmente.'
      using errcode = 'P0005';
  end if;

  calculated_day := public.journey_calculate_day(
    enrollment_record.personal_start_date, local_date
  );

  if calculated_day < 1 then
    raise exception 'O ciclo ainda nao iniciou para este usuario.'
      using errcode = '22023';
  end if;

  if calculated_day > enrollment_record.duration_days then
    raise exception 'O ciclo ja passou da duracao configurada.'
      using errcode = '22023';
  end if;

  select id
  into selected_challenge_day_id
  from public.challenge_days
  where challenge_id = enrollment_record.challenge_id
    and day_number = calculated_day
  limit 1;

  if selected_challenge_day_id is null then
    raise exception 'Dia do ciclo nao configurado.'
      using errcode = 'P0002';
  end if;

  insert into public.daily_logs (
    enrollment_id, challenge_id, challenge_day_id, log_date, rules_snapshot
  )
  values (
    enrollment_record.id, enrollment_record.challenge_id,
    selected_challenge_day_id, local_date, enrollment_record.rules_config
  )
  on conflict do nothing
  returning id into daily_log_id;

  if daily_log_id is null then
    select id into daily_log_id
    from public.daily_logs existing_dl
    where existing_dl.enrollment_id = enrollment_record.id
      and existing_dl.challenge_day_id = selected_challenge_day_id
    limit 1;
  end if;

  if daily_log_id is null then
    select id into daily_log_id
    from public.daily_logs
    where enrollment_id = enrollment_record.id
      and log_date = local_date
    limit 1;
  end if;

  if daily_log_id is null then
    raise exception 'Nao foi possivel abrir o registro diario.'
      using errcode = '23505';
  end if;

  update public.challenge_enrollments
  set current_day = calculated_day
  where id = enrollment_record.id;

  perform public.journey_recalculate_daily_log(daily_log_id);

  return daily_log_id;
end;
$$;

comment on function public.ensure_today_daily_log(uuid) is
  'Abre (ou retorna) o daily_log do dia vigente de uma inscricao. Recusa '
  'com errcode P0005 se a data local do usuario ainda nao alcancou '
  'challenges.start_date - a inscricao antecipada continua permitida, '
  'apenas a execucao (criar log, marcar habito, finalizar dia, pontuar) '
  'fica bloqueada ate o inicio oficial.';
