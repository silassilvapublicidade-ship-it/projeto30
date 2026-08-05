-- Diario dedicado (Parte A.2) - reavaliacao de privacidade pedida pelo
-- usuario, decisao tomada: remover a leitura de CONTEUDO do diario pelo
-- Admin, manter so metadados (existe reflexao, data, contagem de
-- caracteres). Duas correcoes reais encontradas na auditoria:
--
-- 1) A policy de RLS "Users can read own journal entries" (0001) tinha
--    `using (user_id = auth.uid() or public.is_admin())` - is_admin() e
--    verdadeiro para QUALQUER admin (nao so super_admin), entao qualquer
--    admin comum podia ler o texto completo do diario de qualquer usuario
--    via um select direto na tabela, contornando completamente o gate
--    "so super_admin" que admin_participant_detail() aplicava no nivel de
--    RPC. A policy "Admins can manage journal entries" (for all) tinha o
--    mesmo problema, incluindo escrita. Ambas sao substituidas abaixo por
--    uma unica policy de leitura restrita ao proprio dono - nenhuma
--    excecao de admin na tabela. Escrita continua exclusiva da RPC
--    save_journal_entry (security definer, ja existente, nao alterada
--    aqui) - nenhuma policy de insert/update/delete e recriada de
--    proposito, mesmo padrao ja usado em system_error_events/user_feedback.
--
-- 2) admin_participant_detail() (0006) devolvia o texto integral das 5
--    perguntas + humor para super_admin. Passa a devolver so
--    log_date/has_content/character_count para QUALQUER admin - deixa de
--    ser um segredo de super_admin porque deixa de ser conteudo.
alter table public.journal_entries enable row level security;

drop policy if exists "Users can read own journal entries" on public.journal_entries;
drop policy if exists "Admins can manage journal entries" on public.journal_entries;

create policy "Users can read own journal entries"
  on public.journal_entries for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.admin_participant_detail(
  p_enrollment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_window constant interval := interval '3 days';
  v_enrollment record;
  v_daily_history jsonb;
  v_achievements jsonb;
  v_reflections jsonb;
begin
  perform public.admin_require_admin();

  select
    ce.id,
    ce.user_id,
    u.name,
    u.email::text as email,
    ce.challenge_id,
    c.name as challenge_name,
    c.duration_days,
    ce.personal_start_date,
    ce.joined_at,
    ce.status,
    ce.completion_percent,
    ce.points_total,
    ce.streak_current,
    ce.streak_best,
    ce.completed_at,
    (
      select max(dl.updated_at)
      from public.daily_logs dl
      where dl.enrollment_id = ce.id
    ) as last_activity_at
  into v_enrollment
  from public.challenge_enrollments ce
  join public.users u on u.id = ce.user_id
  join public.challenges c on c.id = ce.challenge_id
  where ce.id = p_enrollment_id;

  if v_enrollment.id is null then
    raise exception 'Participante nao encontrado.'
      using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(row_to_json(history) order by history.day_number), '[]'::jsonb)
  into v_daily_history
  from (
    select
      cd.day_number,
      dl.id as daily_log_id,
      dl.status,
      dl.completion_percent,
      dl.points_earned,
      dl.log_date,
      dl.finalized_at
    from public.challenge_days cd
    left join public.daily_logs dl
      on dl.challenge_day_id = cd.id
      and dl.enrollment_id = p_enrollment_id
    where cd.challenge_id = v_enrollment.challenge_id
    order by cd.day_number
  ) history;

  select coalesce(jsonb_agg(row_to_json(unlocked) order by unlocked.unlocked_at), '[]'::jsonb)
  into v_achievements
  from (
    select
      a.name,
      a.slug,
      a.icon,
      ua.unlocked_at
    from public.user_achievements ua
    join public.achievements a on a.id = ua.achievement_id
    where ua.enrollment_id = p_enrollment_id
  ) unlocked;

  select coalesce(jsonb_agg(row_to_json(entry) order by entry.log_date), '[]'::jsonb)
  into v_reflections
  from (
    select
      dl.log_date,
      (
        coalesce(length(je.content), 0) + coalesce(length(je.gratitude), 0) +
        coalesce(length(je.difficulty), 0) + coalesce(length(je.victory), 0) +
        coalesce(length(je.tomorrow_focus), 0)
      ) > 0 as has_content,
      (
        coalesce(length(je.content), 0) + coalesce(length(je.gratitude), 0) +
        coalesce(length(je.difficulty), 0) + coalesce(length(je.victory), 0) +
        coalesce(length(je.tomorrow_focus), 0)
      ) as character_count
    from public.journal_entries je
    join public.daily_logs dl on dl.id = je.daily_log_id
    where je.enrollment_id = p_enrollment_id
  ) entry;

  return jsonb_build_object(
    'enrollment_id', v_enrollment.id,
    'user_id', v_enrollment.user_id,
    'name', v_enrollment.name,
    'email', v_enrollment.email,
    'challenge_id', v_enrollment.challenge_id,
    'challenge_name', v_enrollment.challenge_name,
    'duration_days', v_enrollment.duration_days,
    'personal_start_date', v_enrollment.personal_start_date,
    'joined_at', v_enrollment.joined_at,
    'status', v_enrollment.status,
    'completion_percent', v_enrollment.completion_percent,
    'points_total', v_enrollment.points_total,
    'streak_current', v_enrollment.streak_current,
    'streak_best', v_enrollment.streak_best,
    'completed_at', v_enrollment.completed_at,
    'last_activity_at', v_enrollment.last_activity_at,
    'activity', case
      when v_enrollment.status = 'completed' then 'completed'
      when v_enrollment.status = 'active' and v_enrollment.last_activity_at >= now() - v_active_window then 'active'
      else 'inactive'
    end,
    'daily_history', v_daily_history,
    'achievements', v_achievements,
    'reflections_visible', true,
    'reflections', v_reflections
  );
end;
$$;
