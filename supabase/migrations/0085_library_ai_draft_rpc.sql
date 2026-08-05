-- Parte C (geracao assistida por IA) - admin_create_library_content so
-- sabia criar conteudo manual (source_type/author_type fixos em 'manual'/
-- 'admin'). Em vez de duplicar quase toda a funcao numa RPC paralela,
-- ela e redefinida aqui com os mesmos parametros + 4 novos no final (todos
-- com default que preserva o comportamento manual atual) - toda chamada
-- existente (admin_library.service.ts) continua funcionando identica, sem
-- editar a migration 0084 original (a funcao antiga so e removida por esta
-- NOVA migration, nunca a 0084 em si).
--
-- O rascunho gerado por IA nasce SEMPRE draft (nunca published/approved) -
-- a mesma trava de 'so e possivel publicar ou agendar conteudo ja aprovado'
-- em admin_transition_library_content_status ja impede qualquer atalho.
--
-- Acrescentar parametros no fim NAO substitui a funcao original no
-- Postgres - argumentos diferentes = funcao diferente (ficaria uma
-- segunda sobrecarga ambigua para o PostgREST). Por isso a assinatura
-- antiga de 21 parametros e removida explicitamente antes de criar a
-- versao de 25 - a funcao em si (nome, proposito, RLS via
-- admin_require_admin) continua a mesma, so a assinatura muda.
drop function if exists public.admin_create_library_content(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[],
  integer, text, uuid, uuid, text, text, boolean
);

create function public.admin_create_library_content(
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
  p_requires_enhanced_review boolean default false,
  p_source_type text default 'manual',
  p_author_type text default 'admin',
  p_ai_generation_status text default null,
  p_ai_generation_metadata jsonb default '{}'::jsonb
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

  if p_source_type not in ('manual', 'ai_assisted') then
    raise exception 'source_type invalido.' using errcode = '22023';
  end if;

  if p_author_type not in ('admin', 'ai_assisted') then
    raise exception 'author_type invalido.' using errcode = '22023';
  end if;

  insert into public.library_contents (
    slug, title, pillar, category, subtitle, summary, introduction, body,
    practical_application, reflection_question, small_action, final_message,
    bible_reference, bible_excerpt, tags, reading_time_minutes, difficulty,
    related_challenge_id, related_habit_id, cover_image_url, cover_storage_path,
    requires_enhanced_review, source_type, author_type, ai_generation_status,
    ai_generation_metadata, created_by, updated_by
  )
  values (
    p_slug, p_title, p_pillar, p_category, p_subtitle, p_summary, p_introduction, p_body,
    p_practical_application, p_reflection_question, p_small_action, p_final_message,
    p_bible_reference, p_bible_excerpt, coalesce(p_tags, '{}'), p_reading_time_minutes, coalesce(p_difficulty, 'beginner'),
    p_related_challenge_id, p_related_habit_id, p_cover_image_url, p_cover_storage_path,
    coalesce(p_requires_enhanced_review, false), coalesce(p_source_type, 'manual'), coalesce(p_author_type, 'admin'),
    p_ai_generation_status, coalesce(p_ai_generation_metadata, '{}'::jsonb), v_actor_id, v_actor_id
  )
  returning id into v_id;

  insert into public.admin_audit_logs (action, admin_user_id, entity_type, entity_id, after_json)
  values (
    'admin_create_library_content', v_actor_id, 'library_content', v_id,
    jsonb_build_object('slug', p_slug, 'title', p_title, 'source_type', p_source_type)
  );

  return v_id;
end;
$$;

revoke all on function public.admin_create_library_content(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[],
  integer, text, uuid, uuid, text, text, boolean, text, text, text, jsonb
) from public, anon;
grant execute on function public.admin_create_library_content(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text[],
  integer, text, uuid, uuid, text, text, boolean, text, text, text, jsonb
) to authenticated;
