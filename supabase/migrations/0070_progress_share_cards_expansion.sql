-- Expansao do compartilhamento premium de 2 para 8 tipos (Refinamento
-- premium, Parte E).
--
-- AUDITORIA PREVIA:
-- - share_cards ja suporta 2 "familias" de ancora, cada uma com sua propria
--   coluna nullable + indice unico proprio (documentado em 0014/0066):
--   daily_log_id (progress/streak_record) e user_achievement_id
--   (achievement). O proprio comentario de 0014 ja prescreve o caminho para
--   tipos futuros: "devem adicionar um novo valor aceito aqui via migration
--   propria, com sua propria coluna de ancora nullable".
-- - Dos 6 tipos novos, 1 (streak_reached) e um evento de UM dia especifico -
--   reaproveita a MESMA coluna daily_log_id (mesmo raciocinio de
--   streak_record: o dia em que o marco foi atingido). Os outros 5
--   (halfway, last_7_days, weekly_summary, challenge_progress,
--   challenge_completed) sao fotografias do ESTADO DA INSCRICAO, nunca de
--   um dia isolado - por isso NAO reaproveitam daily_log_id (forcar isso
--   exigiria escolher arbitrariamente "qual dia" representa um resumo
--   semanal ou o progresso do desafio, o que nao e uma ancora real).
-- - Reaproveitar a coluna share_cards.enrollment_id (ja existente, ja
--   preenchida em toda linha) como base do indice unico NAO funciona: ela
--   nunca e nula, entao um indice unico direto nela colidiria com os
--   varios cards 'progress' (um por dia) do MESMO enrollment. Por isso uma
--   nova coluna nullable e necessaria - snapshot_enrollment_id - preenchida
--   SO para os 5 tipos de fotografia, nula para todo o resto (mesma tecnica
--   de desambiguacao por NULL ja usada por user_achievement_id).

alter table public.share_cards
  add column if not exists snapshot_enrollment_id uuid references public.challenge_enrollments(id) on delete cascade;

alter table public.share_cards
  drop constraint if exists share_cards_card_type_check;

alter table public.share_cards
  add constraint share_cards_card_type_check
  check (
    card_type in (
      'progress',
      'streak_record',
      'streak_reached',
      'halfway',
      'last_7_days',
      'weekly_summary',
      'challenge_progress',
      'challenge_completed',
      'achievement'
    )
  );

alter table public.share_cards
  drop constraint if exists share_cards_anchor_check;

alter table public.share_cards
  add constraint share_cards_anchor_check
  check (
    (card_type in ('progress', 'streak_record', 'streak_reached') and daily_log_id is not null)
    or (
      card_type in ('halfway', 'last_7_days', 'weekly_summary', 'challenge_progress', 'challenge_completed')
      and snapshot_enrollment_id is not null
    )
    or (card_type = 'achievement' and user_achievement_id is not null)
  );

create index if not exists share_cards_snapshot_enrollment_idx
  on public.share_cards (snapshot_enrollment_id);

-- Nao-parcial (mesmo raciocinio de share_cards_user_achievement_template_unique
-- em 0014): snapshot_enrollment_id e nulo em toda linha 'progress'/
-- 'streak_record'/'streak_reached'/'achievement', entao essas nunca colidem
-- aqui - a restricao so tem efeito pratico entre as 5 novas linhas de
-- fotografia, exatamente o comportamento desejado.
create unique index if not exists share_cards_snapshot_enrollment_card_type_template_unique
  on public.share_cards (snapshot_enrollment_id, card_type, template_id);

comment on column public.share_cards.snapshot_enrollment_id is
  'Ancora dos 5 tipos de card que fotografam o ESTADO da inscricao (halfway, '
  'last_7_days, weekly_summary, challenge_progress, challenge_completed) - '
  'nunca um dia isolado. Nulo para todo o resto (progress/streak_record/'
  'streak_reached usam daily_log_id; achievement usa user_achievement_id).';

comment on constraint share_cards_card_type_check on public.share_cards is
  '9 tipos: progress/streak_record/streak_reached (daily_log_id); halfway/'
  'last_7_days/weekly_summary/challenge_progress/challenge_completed '
  '(snapshot_enrollment_id); achievement (user_achievement_id).';

-- Presets oficiais dos 6 tipos novos x 2 formatos = 12 templates, globais
-- (challenge_id nulo), mesmo padrao ja usado pelos 2 tipos existentes -
-- config estrutural apenas (formato/dimensoes); cor/cena/efeito vem sempre
-- do codigo (getSceneForAchievement-style mapping em progress-card.core.ts),
-- nunca de texto livre editado pelo admin.
insert into public.share_templates (slug, challenge_id, name, config, active)
values
  ('streak_reached_story', null, 'Sequência atingida - Story', jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'), true),
  ('streak_reached_feed', null, 'Sequência atingida - Feed', jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'), true),
  ('halfway_story', null, 'Metade do desafio - Story', jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'), true),
  ('halfway_feed', null, 'Metade do desafio - Feed', jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'), true),
  ('last_7_days_story', null, 'Últimos 7 dias - Story', jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'), true),
  ('last_7_days_feed', null, 'Últimos 7 dias - Feed', jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'), true),
  ('weekly_summary_story', null, 'Resumo semanal - Story', jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'), true),
  ('weekly_summary_feed', null, 'Resumo semanal - Feed', jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'), true),
  ('challenge_progress_story', null, 'Progresso do desafio - Story', jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'), true),
  ('challenge_progress_feed', null, 'Progresso do desafio - Feed', jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'), true),
  ('challenge_completed_story', null, 'Desafio concluído - Story', jsonb_build_object('width', 1080, 'height', 1920, 'format', 'story'), true),
  ('challenge_completed_feed', null, 'Desafio concluído - Feed', jsonb_build_object('width', 1080, 'height', 1350, 'format', 'feed'), true)
on conflict (slug) where slug is not null do update
set
  config = excluded.config,
  active = excluded.active,
  updated_at = now();
