-- Fase 5: preparar conquistas para compartilhamento.
--
-- AUDITORIA (antes de adicionar qualquer coisa)
-- public.achievements ja tem: name, slug, description, icon, image_url,
-- points_bonus, rule_config (o "criterion" ja existe, so nao tinha esse
-- nome), active, sort_order, challenge_id. public.user_achievements ja
-- registra unlocked_at por usuario/inscricao/conquista.
-- public.share_templates e public.share_cards JA EXISTEM desde
-- 0001_initial_schema.sql, sem nenhuma linha e sem nenhum consumidor de
-- aplicacao ainda - sao exatamente a estrutura de "template visual" e
-- "card gerado" que uma geracao de arte completa (Story/Feed) precisaria,
-- e NAO devem ser duplicadas por uma tabela nova.
--
-- ESCOPO DESTA MIGRATION
-- Adiciona apenas os 4 campos de texto que faltam em achievements para o
-- compartilhamento textual (Web Share API) desta rodada: category, rarity,
-- share_title, share_message. Todos nullable/com default seguro - nenhuma
-- linha existente e afetada.
--
-- O QUE FICA PARA UMA FASE FUTURA (documentado, nao implementado aqui)
-- Geracao de arte (imagem Story 1080x1920 / Feed 1080x1350) reaproveitando
-- share_templates (config jsonb com layout/paleta por desafio) e
-- share_cards (image_url, share_config, generated_at/downloaded_at/shared_at
-- por usuario). Para isso, share_cards precisaria de uma coluna nova
-- `achievement_id uuid references public.achievements(id)` (nullable, pois
-- hoje share_cards so modela cards de progresso diario, nao de conquista) -
-- essa coluna NAO e criada nesta migration, ficando documentada aqui como
-- proximo passo, para nao construir a metade de uma estrutura sem uso real.

alter table public.achievements
  add column if not exists category text,
  add column if not exists rarity text,
  add column if not exists share_title text,
  add column if not exists share_message text;

comment on column public.achievements.category is
  'Categoria livre da conquista (ex.: constancia, forca, disciplina). Nula '
  'quando nao classificada.';
comment on column public.achievements.rarity is
  'Raridade opcional e livre (ex.: comum, rara, epica, lendaria). Nula '
  'quando nao definida - nao e uma escala obrigatoria.';
comment on column public.achievements.share_title is
  'Titulo curto usado no compartilhamento (Web Share API / card futuro). '
  'Quando nulo, a UI usa achievements.name como fallback.';
comment on column public.achievements.share_message is
  'Mensagem curta usada no compartilhamento. Quando nulo, a UI monta uma '
  'mensagem generica a partir de name/description.';

comment on column public.achievements.rule_config is
  'Criterio de desbloqueio (formalizado nesta rodada como o campo '
  '"criterion" do padrao de conquistas - jsonb, nao foi renomeado para nao '
  'quebrar o motor existente em finalize_daily_log()).';
