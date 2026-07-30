-- Fase: reconstrucao completa dos Cards de Dicas em imagem.
--
-- AUDITORIA (antes de qualquer alteracao)
-- public.content_items continua sendo a fonte correta (0011, 0023) - nao ha
-- necessidade de tabela nova. Confirmado por consulta direta ao banco
-- remoto: a tabela esta COMPLETAMENTE VAZIA hoje (0 linhas) - a feature
-- existente nunca foi de fato usada ponta a ponta com uma imagem real via a
-- interface. O unico "dado" relacionado e scripts/content/create-demo-tips.sql,
-- um script administrativo manual (nao uma migration, nao um seed
-- automatico) que nunca foi executado contra o remoto.
--
-- Esta migration alinha os nomes de coluna ao vocabulario pedido nesta
-- rodada (content_type/tip_card no lugar de type/tip; summary/content/
-- image_url no lugar de excerpt/body/media_url; created_by no lugar de
-- author_id) e adiciona as colunas realmente ausentes (image_storage_path,
-- updated_by) mais os indices pedidos. Como a tabela esta vazia, os renames
-- e o update de valor sao completamente seguros - nenhuma linha real e
-- afetada. Nenhuma outra tabela, policy ou funcao referencia estas colunas
-- pelo nome antigo (confirmado por busca completa no schema antes de
-- escrever esta migration), entao nenhuma policy/funcao precisa ser
-- recriada.

alter table public.content_items
  rename column type to content_type;

alter table public.content_items
  rename column excerpt to summary;

alter table public.content_items
  rename column body to content;

alter table public.content_items
  rename column media_url to image_url;

alter table public.content_items
  rename column author_id to created_by;

-- Tabela vazia hoje, mas este update cobre o caso de qualquer linha futura
-- inserida entre o audit acima e a aplicacao desta migration.
update public.content_items
set content_type = 'tip_card'
where content_type = 'tip';

alter table public.content_items
  add column if not exists image_storage_path text,
  add column if not exists updated_by uuid references public.users(id) on delete set null;

comment on column public.content_items.image_storage_path is
  'Caminho literal no bucket tip-cards (tips/{content_item_id}/{version}.webp), '
  'distinto de image_url (a URL publica). Usado para apagar/substituir o '
  'arquivo certo sem precisar re-parsear a URL.';
comment on column public.content_items.created_by is
  'Admin que criou o card (renomeado de author_id).';
comment on column public.content_items.updated_by is
  'Ultimo admin que editou o card - nulo se nunca editado apos a criacao.';

-- Indices pedidos explicitamente: content_type, status, category,
-- display_order, published_at, starts_at, ends_at. Mais um composto para o
-- padrao de leitura real do usuario (content_type + status + janela).
create index if not exists content_items_content_type_idx
  on public.content_items (content_type);
create index if not exists content_items_status_idx
  on public.content_items (status);
create index if not exists content_items_category_idx
  on public.content_items (category);
create index if not exists content_items_display_order_idx
  on public.content_items (display_order);
create index if not exists content_items_published_at_idx
  on public.content_items (published_at);
create index if not exists content_items_starts_at_idx
  on public.content_items (starts_at);
create index if not exists content_items_ends_at_idx
  on public.content_items (ends_at);
create index if not exists content_items_type_status_order_idx
  on public.content_items (content_type, status, display_order);

-- Atualiza o script administrativo manual (nao migration, nao roda
-- automaticamente) para o vocabulario novo, para que continue correto se um
-- operador algum dia o executar - nunca foi rodado contra o remoto, entao
-- nao ha dado real a migrar por causa dele.
