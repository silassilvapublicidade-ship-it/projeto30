-- Fase 5: area de Dicas.
--
-- AUDITORIA (antes de criar qualquer tabela nova)
-- public.content_items ja existe desde 0001_initial_schema.sql, com RLS
-- habilitada e as colunas que "Dicas" precisa, quase todas ja presentes:
--   id, challenge_id (nullable), type (text livre), title, slug (unique),
--   excerpt, body, media_url, status (draft/published/archived),
--   published_at, author_id, created_at, updated_at.
-- Faltam apenas duas colunas (category, display_order). Reaproveitar esta
-- tabela evita criar uma estrutura paralela so para "dicas" - o discriminador
-- `type = 'tip'` (coluna ja existente) separa dicas de qualquer outro tipo
-- de conteudo que venha a usar esta mesma tabela no futuro.
--
-- Mapeamento Dica -> content_items:
--   id -> id | title -> title | slug -> slug | summary -> excerpt
--   content -> body | image_url -> media_url | category -> category (novo)
--   challenge_id -> challenge_id | status -> status
--   published_at -> published_at | display_order -> display_order (novo)
--   created_at/updated_at -> created_at/updated_at
--
-- Nao apaga nem redefine nenhuma linha existente. Nao toca em nenhuma outra
-- tabela.

alter table public.content_items
  add column if not exists category text,
  add column if not exists display_order integer not null default 0;

comment on column public.content_items.category is
  'Categoria livre da dica (ex.: hidratacao, sono, treino). Nula para tipos '
  'de conteudo que nao usam categoria.';
comment on column public.content_items.display_order is
  'Ordem de exibicao dentro de uma listagem (menor primeiro). Default 0 - '
  'nao afeta linhas ja existentes, que continuam ordenaveis por created_at.';

-- A policy de leitura publica original ("Anyone can read published content",
-- sem `to authenticated`) e mais permissiva do que o padrao definido para
-- Dicas ("membros autenticados podem ler dicas publicadas"). Como esta
-- rodada formaliza o uso desta tabela para conteudo lido dentro da area de
-- membros (autenticada), a policy de leitura e substituida por uma
-- equivalente restrita a `authenticated`. Nao ha linhas publicadas hoje
-- (tabela em uso apenas por fixtures de tipo futuro), entao este aperto nao
-- quebra nenhum consumidor real existente.
drop policy if exists "Anyone can read published content" on public.content_items;

create policy "Authenticated users can read published content"
  on public.content_items for select
  to authenticated
  using (status = 'published');

-- "Admins can manage content" (all, is_admin()) ja cobre rascunhos e
-- escrita administrativa - nao precisa ser recriada.
