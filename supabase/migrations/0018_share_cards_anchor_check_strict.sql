-- Fase 6, Rodada B: corrige uma lacuna real encontrada na validacao ao vivo
-- de 0014_achievement_share_cards.sql.
--
-- PROBLEMA ENCONTRADO (testado ao vivo, com rollback, contra fixtures reais
-- do usuario QA e do Desafio de Agosto):
-- share_cards_anchor_check (criada em 0014) so exigia que a coluna de
-- ancora CORRESPONDENTE ao card_type estivesse preenchida - nao impedia:
--   1) um card 'achievement' com daily_log_id E user_achievement_id
--      preenchidos ao mesmo tempo (ambiguo: qual e a ancora real do card?);
--   2) um card 'achievement' com user_achievement_id preenchido mas
--      achievement_id nulo (a conquista em si nao fica identificada, so o
--      evento de desbloqueio).
-- Confirmado ao vivo: ambas as inserções foram aceitas quando deveriam ser
-- rejeitadas.
--
-- CORRECAO
-- share_cards_anchor_check e redefinida para exigir, por card_type:
--   progress:    daily_log_id preenchido, achievement_id E
--                user_achievement_id OBRIGATORIAMENTE nulos;
--   achievement: user_achievement_id E achievement_id preenchidos,
--                daily_log_id OBRIGATORIAMENTE nulo.
-- Nao ha dado real em share_cards para migrar (0 linhas em producao,
-- confirmado antes desta migration) - a troca da constraint e segura.
--
-- Nao altera nenhuma outra coluna, indice, policy ou bucket criados em
-- 0014. Nao toca em join/finalize/analytics (0015-0017).

alter table public.share_cards
  drop constraint if exists share_cards_anchor_check;

alter table public.share_cards
  add constraint share_cards_anchor_check
  check (
    (
      card_type = 'progress'
      and daily_log_id is not null
      and achievement_id is null
      and user_achievement_id is null
    )
    or (
      card_type = 'achievement'
      and user_achievement_id is not null
      and achievement_id is not null
      and daily_log_id is null
    )
  );

comment on constraint share_cards_anchor_check on public.share_cards is
  'Cada card tem exatamente uma ancora, totalmente preenchida: progress '
  'exige somente daily_log_id; achievement exige somente achievement_id + '
  'user_achievement_id juntos. Nunca os dois tipos de ancora ao mesmo tempo.';
