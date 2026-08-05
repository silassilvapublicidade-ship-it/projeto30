-- Diario dedicado (Parte A) - /app/diario deixa de ser um placeholder que
-- mente para o usuario. Nao cria uma segunda tabela nem uma segunda
-- funcao de escrita: le journal_entries (ja gravada por save_journal_entry,
-- inalterada aqui), paginada e filtrada, sempre escopada ao proprio
-- usuario (auth.uid() - nao precisa nem checar RLS porque e security
-- definer, mas o filtro abaixo e explicito e nao-opcional).
create or replace function public.member_list_journal_entries(
  p_challenge_id uuid default null,
  p_period_days integer default null,
  p_only_with_content boolean default false,
  p_search text default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_limit integer := greatest(least(coalesce(p_limit, 20), 50), 1);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb;
  v_total integer;
begin
  if v_user_id is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  select count(*)
  into v_total
  from public.journal_entries je
  join public.daily_logs dl on dl.id = je.daily_log_id
  join public.challenge_enrollments ce on ce.id = je.enrollment_id
  where je.user_id = v_user_id
    and (p_challenge_id is null or ce.challenge_id = p_challenge_id)
    and (p_period_days is null or dl.log_date >= (current_date - make_interval(days => p_period_days)))
    and (
      not p_only_with_content
      or coalesce(length(je.content), 0) + coalesce(length(je.gratitude), 0)
         + coalesce(length(je.difficulty), 0) + coalesce(length(je.victory), 0)
         + coalesce(length(je.tomorrow_focus), 0) > 0
    )
    and (
      v_search is null
      or je.content ilike '%' || v_search || '%'
      or je.gratitude ilike '%' || v_search || '%'
      or je.difficulty ilike '%' || v_search || '%'
      or je.victory ilike '%' || v_search || '%'
      or je.tomorrow_focus ilike '%' || v_search || '%'
    );

  select coalesce(jsonb_agg(row_to_json(r) order by r.log_date desc), '[]'::jsonb)
  into v_rows
  from (
    select
      dl.id as daily_log_id,
      dl.log_date,
      dl.status as daily_log_status,
      dl.finalized_at,
      dl.points_earned,
      ce.challenge_id,
      c.name as challenge_name,
      cd.day_number,
      cd.message as challenge_day_message,
      je.content,
      je.gratitude,
      je.difficulty,
      je.victory,
      je.tomorrow_focus,
      je.mood,
      je.updated_at
    from public.journal_entries je
    join public.daily_logs dl on dl.id = je.daily_log_id
    join public.challenge_enrollments ce on ce.id = je.enrollment_id
    join public.challenges c on c.id = ce.challenge_id
    left join public.challenge_days cd on cd.id = dl.challenge_day_id
    where je.user_id = v_user_id
      and (p_challenge_id is null or ce.challenge_id = p_challenge_id)
      and (p_period_days is null or dl.log_date >= (current_date - make_interval(days => p_period_days)))
      and (
        not p_only_with_content
        or coalesce(length(je.content), 0) + coalesce(length(je.gratitude), 0)
           + coalesce(length(je.difficulty), 0) + coalesce(length(je.victory), 0)
           + coalesce(length(je.tomorrow_focus), 0) > 0
      )
      and (
        v_search is null
        or je.content ilike '%' || v_search || '%'
        or je.gratitude ilike '%' || v_search || '%'
        or je.difficulty ilike '%' || v_search || '%'
        or je.victory ilike '%' || v_search || '%'
        or je.tomorrow_focus ilike '%' || v_search || '%'
      )
    order by dl.log_date desc
    limit v_limit
    offset v_offset
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

revoke all on function public.member_list_journal_entries(uuid, integer, boolean, text, integer, integer) from public, anon;
grant execute on function public.member_list_journal_entries(uuid, integer, boolean, text, integer, integer) to authenticated;

-- Lista os desafios do usuario para popular o filtro "Desafio" na UI, sem
-- carregar o historico inteiro so para montar um <select>.
create or replace function public.member_list_journal_challenges()
returns jsonb
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  from (
    select distinct c.id as challenge_id, c.name as challenge_name
    from public.journal_entries je
    join public.challenge_enrollments ce on ce.id = je.enrollment_id
    join public.challenges c on c.id = ce.challenge_id
    where je.user_id = auth.uid()
    order by c.name
  ) r;
$$;

revoke all on function public.member_list_journal_challenges() from public, anon;
grant execute on function public.member_list_journal_challenges() to authenticated;
