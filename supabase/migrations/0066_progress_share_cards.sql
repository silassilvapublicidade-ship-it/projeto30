-- Compartilhamento premium de progresso (Parte D).
--
-- AUDITORIA PREVIA:
-- - share_cards.card_type ja e um discriminador texto+check pensado
--   exatamente para isto desde 0014_achievement_share_cards.sql: 'progress'
--   ja existe (0 linhas hoje - nunca foi usado), ja ancorado em
--   daily_log_id (nullable), com a check share_cards_anchor_check exigindo
--   card_type='progress' => daily_log_id not null. O proprio comentario da
--   coluna (0014) documenta o caminho: "Novos tipos futuros (...) devem
--   adicionar um novo valor aceito aqui via migration propria, com sua
--   propria coluna de ancora nullable" - aqui o novo valor e
--   'streak_record', reaproveitando a MESMA coluna de ancora (daily_log_id:
--   um recorde de sequencia acontece num finalize especifico, a mesma linha
--   de daily_logs que member_profile_timeline ja usa como event_source_id
--   para o tipo streak_record - nenhuma coluna nova precisa ser criada).
-- - Nao existe uma segunda engine: reaproveita share_templates,
--   share_cards, o bucket "achievement-share-cards" e
--   renderAchievementShareCardImage's primitives (fontes, logo, camadas,
--   cenas) - so um novo par de content-builder/render exportado do MESMO
--   modulo de rendering (achievement-share-card.render.tsx), nunca um
--   arquivo/tabela paralelos.
-- - Escopo desta rodada: 2 dos 8 tipos pedidos no briefing (dia concluido =
--   card_type 'progress', novo recorde = card_type 'streak_record').
--   Progresso do desafio, metade, ultimos 7 dias, desafio concluido e
--   resumo semanal ficam documentados como pendencia no relatorio final -
--   cada um exigiria sua propria ancora/dado e validacao visual real, fora
--   do escopo razoavel desta rodada.

alter table public.share_cards
  drop constraint if exists share_cards_card_type_check;

alter table public.share_cards
  add constraint share_cards_card_type_check
  check (card_type in ('progress', 'achievement', 'streak_record'));

alter table public.share_cards
  drop constraint if exists share_cards_anchor_check;

alter table public.share_cards
  add constraint share_cards_anchor_check
  check (
    (card_type in ('progress', 'streak_record') and daily_log_id is not null)
    or (card_type = 'achievement' and user_achievement_id is not null)
  );

-- share_cards_user_achievement_template_unique (0014) so cobre o par
-- (user_achievement_id, template_id) - cards ancorados em daily_log_id
-- (progress/streak_record) precisam da sua propria chave de idempotencia.
-- Indice comum (nao parcial), mesmo raciocinio de 0014: Postgres trata cada
-- NULL como distinto em indices unicos, entao linhas de conquista
-- (daily_log_id sempre nulo) nunca colidem aqui.
create unique index if not exists share_cards_daily_log_card_type_template_unique
  on public.share_cards (daily_log_id, card_type, template_id);

comment on constraint share_cards_card_type_check on public.share_cards is
  'progress = card de dia concluido (daily_log_id obrigatorio); '
  'streak_record = card de novo recorde de sequencia (daily_log_id do dia '
  'em que o recorde foi batido, obrigatorio); achievement = card de '
  'conquista desbloqueada (user_achievement_id obrigatorio).';

-- Presets oficiais para os 2 tipos desta rodada (globais - challenge_id
-- nulo, mesmo padrao de achievement_story/achievement_feed). Config
-- estrutural apenas (formato/dimensoes) - cor/efeito/cena continuam vindo
-- do codigo (achievement-rarity.core.ts style token, achievement-scene.core.ts),
-- nunca de texto livre editado pelo admin.
insert into public.share_templates (slug, challenge_id, name, config, active)
values
  (
    'progress_day_story',
    null,
    'Dia concluido - Story',
    jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'),
    true
  ),
  (
    'progress_day_feed',
    null,
    'Dia concluido - Feed',
    jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'),
    true
  ),
  (
    'streak_record_story',
    null,
    'Novo recorde - Story',
    jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'),
    true
  ),
  (
    'streak_record_feed',
    null,
    'Novo recorde - Feed',
    jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'),
    true
  )
on conflict (slug) where slug is not null do update
set
  config = excluded.config,
  active = excluded.active,
  updated_at = now();
