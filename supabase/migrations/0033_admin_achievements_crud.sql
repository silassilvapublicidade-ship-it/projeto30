-- Module E: safe-delete backing for the admin achievements CRUD.
--
-- AUDITORIA PREVIA (ver relatorio do modulo): a coluna achievements.rule_config
-- e hoje dado morto - tanto finalize_daily_log() (SQL) quanto
-- getUnlockedAchievementSlugs()/getAchievementProgress() (TypeScript) decidem
-- o desbloqueio por um switch fixo em 10 slugs canonicos, ignorando os
-- parametros numericos de rule_config. Por decisao explicita do usuario, o
-- CRUD deste modulo fica restrito a METADADOS (nome, descricao, icone,
-- categoria, raridade, textos de compartilhamento, pontos, ordem, ativo) das
-- 10 conquistas canonicas por desafio - nao reescreve o motor de
-- desbloqueio. slug/rule_config so sao gravados na criacao, a partir de um
-- enum fixo de 10 tipos (mapeado em admin-achievements.schemas.ts), e nunca
-- editados depois - nunca ha JSON livre vindo do cliente.
--
-- Create/update em si nao precisam de RPC nova: a RLS existente ja permite
-- "Admins can manage achievements" (for all, 0001_initial_schema.sql) via
-- INSERT/UPDATE direto pelo cliente autenticado - mesmo padrao ja usado por
-- admin-tips.service.ts para content_items (conteudo editorial de baixo
-- volume). O que falta e a protecao de "conquista ja usada" no delete: as
-- FKs de user_achievements e share_cards para achievements.id sao
-- ON DELETE CASCADE (0001/0014), entao o Postgres nunca bloqueia sozinho -
-- um DELETE direto apagaria silenciosamente o historico de desbloqueio e as
-- artes geradas de qualquer usuario. Por isso o delete passa por uma RPC que
-- releva a contagem real de user_achievements ANTES de decidir, do mesmo
-- jeito que admin_test_challenge_purge_preview/admin_delete_test_challenge_permanently
-- (0022_test_challenge_purge.sql) fazem para desafios de teste.

create or replace function public.admin_achievement_delete_preview(
  p_achievement_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_achievement record;
  v_unlocked_count integer;
begin
  perform public.admin_require_admin();

  select a.id, a.name, a.challenge_id
  into v_achievement
  from public.achievements a
  where a.id = p_achievement_id;

  if v_achievement.id is null then
    raise exception 'Conquista nao encontrada.'
      using errcode = 'P0002';
  end if;

  select count(*) into v_unlocked_count
  from public.user_achievements
  where achievement_id = p_achievement_id;

  return jsonb_build_object(
    'achievement_id', v_achievement.id,
    'name', v_achievement.name,
    'challenge_id', v_achievement.challenge_id,
    'unlocked_count', v_unlocked_count,
    'can_delete', v_unlocked_count = 0
  );
end;
$$;

revoke execute on function public.admin_achievement_delete_preview(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_achievement_delete_preview(uuid)
  to authenticated;

-- Re-validates the same unlocked_count = 0 guard server-side (never trusts
-- that the client actually showed/respected the preview) before deleting.
-- Unlike the test-challenge purge, this is never bypassable with a typed
-- confirmation phrase - an already-unlocked achievement can only be disabled
-- (achievements.active = false, plain UPDATE via existing RLS), never
-- deleted, so real users never lose their unlock history or share art.
create or replace function public.admin_delete_achievement(
  p_achievement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unlocked_count integer;
  v_deleted_id uuid;
begin
  perform public.admin_require_admin();

  select count(*) into v_unlocked_count
  from public.user_achievements
  where achievement_id = p_achievement_id;

  if v_unlocked_count > 0 then
    raise exception 'Esta conquista ja foi desbloqueada por pelo menos um usuario e nao pode ser excluida. Desative-a em vez disso.'
      using errcode = 'P0003';
  end if;

  delete from public.achievements
  where id = p_achievement_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Conquista nao encontrada.'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_delete_achievement(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_achievement(uuid)
  to authenticated;
