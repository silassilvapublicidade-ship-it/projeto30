-- Biblioteca - RPCs de leitura (membro) e CRUD/fluxo editorial (admin).
-- Fluxo de status enforced no proprio RPC (Parte 13): draft -> in_review
-- -> approved -> (scheduled|published) -> archived. Nunca permite
-- draft/in_review pularem direto para published numa unica chamada -
-- publicacao sempre exige uma acao humana explicita e um estado
-- aprovado antes.

create or replace function public.member_list_library_contents(
  p_pillar text default null,
  p_category text default null,
  p_challenge_id uuid default null,
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

  select count(*) into v_total
  from public.library_contents lc
  where lc.status = 'published'
    and (p_pillar is null or lc.pillar = p_pillar)
    and (p_category is null or lc.category = p_category)
    and (p_challenge_id is null or lc.related_challenge_id = p_challenge_id)
    and (v_search is null or lc.title ilike '%' || v_search || '%' or lc.summary ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(row_to_json(r) order by r.published_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      lc.id, lc.slug, lc.title, lc.subtitle, lc.summary, lc.pillar, lc.category,
      lc.reading_time_minutes, lc.cover_image_url, lc.published_at, lc.tags,
      coalesce(lrp.status, 'not_started') as progress_status,
      coalesce(lrp.progress_percent, 0) as progress_percent
    from public.library_contents lc
    left join public.library_reading_progress lrp
      on lrp.content_id = lc.id and lrp.user_id = v_user_id
    where lc.status = 'published'
      and (p_pillar is null or lc.pillar = p_pillar)
      and (p_category is null or lc.category = p_category)
      and (p_challenge_id is null or lc.related_challenge_id = p_challenge_id)
      and (v_search is null or lc.title ilike '%' || v_search || '%' or lc.summary ilike '%' || v_search || '%')
    order by lc.published_at desc
    limit v_limit
    offset v_offset
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

revoke all on function public.member_list_library_contents(text, text, uuid, text, integer, integer) from public, anon;
grant execute on function public.member_list_library_contents(text, text, uuid, text, integer, integer) to authenticated;

create or replace function public.member_get_library_content(p_slug text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_content record;
  v_progress jsonb;
  v_related jsonb;
begin
  if v_user_id is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  select * into v_content
  from public.library_contents
  where slug = p_slug and status = 'published';

  if v_content.id is null then
    return null;
  end if;

  select row_to_json(p) into v_progress
  from (
    select status, progress_percent, started_at, completed_at
    from public.library_reading_progress
    where user_id = v_user_id and content_id = v_content.id
  ) p;

  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb) into v_related
  from (
    select id, slug, title, summary, pillar, reading_time_minutes, cover_image_url
    from public.library_contents
    where status = 'published'
      and id <> v_content.id
      and (pillar = v_content.pillar or related_challenge_id = v_content.related_challenge_id)
    order by published_at desc
    limit 3
  ) r;

  return jsonb_build_object(
    'id', v_content.id,
    'slug', v_content.slug,
    'title', v_content.title,
    'subtitle', v_content.subtitle,
    'summary', v_content.summary,
    'introduction', v_content.introduction,
    'body', v_content.body,
    'practical_application', v_content.practical_application,
    'reflection_question', v_content.reflection_question,
    'small_action', v_content.small_action,
    'final_message', v_content.final_message,
    'bible_reference', v_content.bible_reference,
    'bible_excerpt', v_content.bible_excerpt,
    'tags', v_content.tags,
    'pillar', v_content.pillar,
    'category', v_content.category,
    'reading_time_minutes', v_content.reading_time_minutes,
    'cover_image_url', v_content.cover_image_url,
    'published_at', v_content.published_at,
    'progress', v_progress,
    'related', v_related
  );
end;
$$;

revoke all on function public.member_get_library_content(text) from public, anon;
grant execute on function public.member_get_library_content(text) to authenticated;

create or replace function public.member_upsert_library_progress(
  p_content_id uuid,
  p_status text,
  p_progress_percent numeric default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  if p_status not in ('not_started', 'reading', 'completed') then
    raise exception 'Status invalido.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.library_contents where id = p_content_id and status = 'published') then
    raise exception 'Conteudo nao encontrado.' using errcode = 'P0002';
  end if;

  insert into public.library_reading_progress (user_id, content_id, status, progress_percent, started_at, completed_at)
  values (
    v_user_id, p_content_id, p_status, greatest(least(coalesce(p_progress_percent, 0), 100), 0),
    case when p_status in ('reading', 'completed') then now() else null end,
    case when p_status = 'completed' then now() else null end
  )
  on conflict (user_id, content_id) do update set
    status = excluded.status,
    progress_percent = excluded.progress_percent,
    started_at = coalesce(public.library_reading_progress.started_at, excluded.started_at),
    completed_at = case when excluded.status = 'completed' then now() else public.library_reading_progress.completed_at end;
end;
$$;

revoke all on function public.member_upsert_library_progress(uuid, text, numeric) from public, anon;
grant execute on function public.member_upsert_library_progress(uuid, text, numeric) to authenticated;

-- Recomendacao contextual (Parte 9) - versao deliberadamente simples:
-- seleciona conteudo APROVADO/publicado ja existente com base em sinais
-- reais e ja carregados (streak/dia do ciclo), nunca gera nada novo em
-- tempo real e nunca faz diagnostico. "Perdeu sequencia" e "metade do
-- desafio" sao os 2 sinais mais fortes/inequivocos entre os 7 exemplos
-- dados - os outros (por categoria de habito) dependem de um vinculo
-- habito->pilar que ainda nao existe em nenhuma tabela; ficam de fora
-- desta versao para nao inventar heuristica fragil.
create or replace function public.member_get_library_recommendation()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_enrollment record;
  v_pillar text;
  v_result jsonb;
begin
  if v_user_id is null then
    return null;
  end if;

  select ce.id, ce.current_day, ce.streak_current, c.duration_days
  into v_enrollment
  from public.challenge_enrollments ce
  join public.challenges c on c.id = ce.challenge_id
  where ce.user_id = v_user_id and ce.status = 'active'
  order by ce.created_at desc
  limit 1;

  if v_enrollment.id is null then
    return null;
  end if;

  v_pillar := case
    when v_enrollment.streak_current = 0 then 'character'
    when v_enrollment.current_day::numeric / nullif(v_enrollment.duration_days, 0) between 0.4 and 0.6 then 'spirit'
    when v_enrollment.duration_days - v_enrollment.current_day <= 7 then 'mind'
    else 'body'
  end;

  select row_to_json(r) into v_result
  from (
    select id, slug, title, summary, pillar, reading_time_minutes, cover_image_url
    from public.library_contents
    where status = 'published' and pillar = v_pillar
    order by published_at desc
    limit 1
  ) r;

  return v_result;
end;
$$;

revoke all on function public.member_get_library_recommendation() from public, anon;
grant execute on function public.member_get_library_recommendation() to authenticated;

-- --------------------------------------------------------------------
-- Admin: CRUD + fluxo editorial
-- --------------------------------------------------------------------

create or replace function public.admin_list_library_contents(
  p_status text default null,
  p_pillar text default null,
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
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_limit integer := greatest(least(coalesce(p_limit, 20), 50), 1);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_rows jsonb;
  v_total integer;
begin
  perform public.admin_require_admin();

  select count(*) into v_total
  from public.library_contents lc
  where (p_status is null or lc.status = p_status)
    and (p_pillar is null or lc.pillar = p_pillar)
    and (v_search is null or lc.title ilike '%' || v_search || '%');

  select coalesce(jsonb_agg(row_to_json(r) order by r.updated_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      lc.id, lc.slug, lc.title, lc.pillar, lc.category, lc.status, lc.source_type,
      lc.requires_enhanced_review, lc.updated_at, lc.published_at, lc.scheduled_at
    from public.library_contents lc
    where (p_status is null or lc.status = p_status)
      and (p_pillar is null or lc.pillar = p_pillar)
      and (v_search is null or lc.title ilike '%' || v_search || '%')
    order by lc.updated_at desc
    limit v_limit
    offset v_offset
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

revoke all on function public.admin_list_library_contents(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_library_contents(text, text, text, integer, integer) to authenticated;

create or replace function public.admin_get_library_content(p_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
begin
  perform public.admin_require_admin();

  select to_jsonb(lc) into v_row from public.library_contents lc where lc.id = p_id;
  return v_row;
end;
$$;

revoke all on function public.admin_get_library_content(uuid) from public, anon;
grant execute on function public.admin_get_library_content(uuid) to authenticated;

create or replace function public.admin_create_library_content(
  p_slug text,
  p_title text,
  p_pillar text,
  p_category text default null,
  p_subtitle text default null,
  p_summary text default null,
  p_introduction text default null,
  p_body text default null,
  p_practical_application text default null,
  p_reflection_question text default null,
  p_small_action text default null,
  p_final_message text default null,
  p_bible_reference text default null,
  p_bible_excerpt text default null,
  p_tags text[] default '{}',
  p_reading_time_minutes integer default null,
  p_difficulty text default 'beginner',
  p_related_challenge_id uuid default null,
  p_related_habit_id uuid default null,
  p_cover_image_url text default null,
  p_cover_storage_path text default null,
  p_requires_enhanced_review boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
begin
  perform public.admin_require_admin();

  if p_pillar not in ('body', 'mind', 'character', 'spirit') then
    raise exception 'Pilar invalido.' using errcode = '22023';
  end if;

  insert into public.library_contents (
    slug, title, pillar, category, subtitle, summary, introduction, body,
    practical_application, reflection_question, small_action, final_message,
    bible_reference, bible_excerpt, tags, reading_time_minutes, difficulty,
    related_challenge_id, related_habit_id, cover_image_url, cover_storage_path,
    requires_enhanced_review, source_type, author_type, created_by, updated_by
  )
  values (
    p_slug, p_title, p_pillar, p_category, p_subtitle, p_summary, p_introduction, p_body,
    p_practical_application, p_reflection_question, p_small_action, p_final_message,
    p_bible_reference, p_bible_excerpt, coalesce(p_tags, '{}'), p_reading_time_minutes, coalesce(p_difficulty, 'beginner'),
    p_related_challenge_id, p_related_habit_id, p_cover_image_url, p_cover_storage_path,
    coalesce(p_requires_enhanced_review, false), 'manual', 'admin', v_actor_id, v_actor_id
  )
  returning id into v_id;

  insert into public.admin_audit_logs (action, admin_user_id, entity_type, entity_id, after_json)
  values ('admin_create_library_content', v_actor_id, 'library_content', v_id, jsonb_build_object('slug', p_slug, 'title', p_title));

  return v_id;
end;
$$;

revoke all on function public.admin_create_library_content(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[],
  integer, text, uuid, uuid, text, text, boolean
) from public, anon;
grant execute on function public.admin_create_library_content(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[],
  integer, text, uuid, uuid, text, text, boolean
) to authenticated;

create or replace function public.admin_update_library_content(
  p_id uuid,
  p_title text default null,
  p_pillar text default null,
  p_category text default null,
  p_subtitle text default null,
  p_summary text default null,
  p_introduction text default null,
  p_body text default null,
  p_practical_application text default null,
  p_reflection_question text default null,
  p_small_action text default null,
  p_final_message text default null,
  p_bible_reference text default null,
  p_bible_excerpt text default null,
  p_tags text[] default null,
  p_reading_time_minutes integer default null,
  p_difficulty text default null,
  p_related_challenge_id uuid default null,
  p_related_habit_id uuid default null,
  p_cover_image_url text default null,
  p_cover_storage_path text default null,
  p_requires_enhanced_review boolean default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  perform public.admin_require_admin();

  if p_pillar is not null and p_pillar not in ('body', 'mind', 'character', 'spirit') then
    raise exception 'Pilar invalido.' using errcode = '22023';
  end if;

  update public.library_contents set
    title = coalesce(p_title, title),
    pillar = coalesce(p_pillar, pillar),
    category = coalesce(p_category, category),
    subtitle = coalesce(p_subtitle, subtitle),
    summary = coalesce(p_summary, summary),
    introduction = coalesce(p_introduction, introduction),
    body = coalesce(p_body, body),
    practical_application = coalesce(p_practical_application, practical_application),
    reflection_question = coalesce(p_reflection_question, reflection_question),
    small_action = coalesce(p_small_action, small_action),
    final_message = coalesce(p_final_message, final_message),
    bible_reference = coalesce(p_bible_reference, bible_reference),
    bible_excerpt = coalesce(p_bible_excerpt, bible_excerpt),
    tags = coalesce(p_tags, tags),
    reading_time_minutes = coalesce(p_reading_time_minutes, reading_time_minutes),
    difficulty = coalesce(p_difficulty, difficulty),
    related_challenge_id = coalesce(p_related_challenge_id, related_challenge_id),
    related_habit_id = coalesce(p_related_habit_id, related_habit_id),
    cover_image_url = coalesce(p_cover_image_url, cover_image_url),
    cover_storage_path = coalesce(p_cover_storage_path, cover_storage_path),
    requires_enhanced_review = coalesce(p_requires_enhanced_review, requires_enhanced_review),
    updated_by = v_actor_id
  where id = p_id;

  if not found then
    raise exception 'Conteudo nao encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_update_library_content(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text[],
  integer, text, uuid, uuid, text, text, boolean
) from public, anon;
grant execute on function public.admin_update_library_content(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text[],
  integer, text, uuid, uuid, text, text, boolean
) to authenticated;

-- Transicao de status - o unico caminho para published/scheduled. Nunca
-- aceita draft/in_review indo direto para published (Parte 13: exige
-- passar por approved primeiro; publicacao e sempre uma acao humana
-- explicita, nunca automatica).
create or replace function public.admin_transition_library_content_status(
  p_id uuid,
  p_status text,
  p_scheduled_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current text;
begin
  perform public.admin_require_admin();

  if p_status not in ('draft', 'in_review', 'approved', 'scheduled', 'published', 'archived') then
    raise exception 'Status invalido.' using errcode = '22023';
  end if;

  select status into v_current from public.library_contents where id = p_id;

  if v_current is null then
    raise exception 'Conteudo nao encontrado.' using errcode = 'P0002';
  end if;

  if p_status in ('published', 'scheduled') and v_current not in ('approved', 'scheduled') then
    raise exception 'So e possivel publicar ou agendar conteudo ja aprovado.' using errcode = '22023';
  end if;

  update public.library_contents set
    status = p_status,
    approved_by = case when p_status = 'approved' then v_actor_id else approved_by end,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    published_by = case when p_status = 'published' then v_actor_id else published_by end,
    published_at = case when p_status = 'published' then now() else published_at end,
    scheduled_at = case when p_status = 'scheduled' then p_scheduled_at else scheduled_at end,
    updated_by = v_actor_id
  where id = p_id;

  insert into public.admin_audit_logs (action, admin_user_id, entity_type, entity_id, before_json, after_json)
  values (
    'admin_transition_library_content_status', v_actor_id, 'library_content', p_id,
    jsonb_build_object('status', v_current),
    jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.admin_transition_library_content_status(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_transition_library_content_status(uuid, text, timestamptz) to authenticated;

-- "Enviar para revisao" e "marcar revisado" so tocam reviewed_by/reviewed_at,
-- sem passar pelo mesmo caminho de aprovacao/publicacao.
create or replace function public.admin_mark_library_content_reviewed(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  perform public.admin_require_admin();

  update public.library_contents
  set reviewed_by = v_actor_id, reviewed_at = now(), status = 'in_review', updated_by = v_actor_id
  where id = p_id;

  if not found then
    raise exception 'Conteudo nao encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_mark_library_content_reviewed(uuid) from public, anon;
grant execute on function public.admin_mark_library_content_reviewed(uuid) to authenticated;
