-- Parte D - Dicas (rapidas) e Biblioteca (mais profunda) nao competem; o
-- admin pode opcionalmente linkar um card de dica a um conteudo da
-- Biblioteca ("Quero aprender mais"). Link nunca obrigatorio - coluna
-- nullable, on delete set null (se o conteudo da Biblioteca for removido, a
-- dica simplesmente perde o link, nunca quebra).
alter table public.content_items
  add column if not exists related_library_content_id uuid references public.library_contents(id) on delete set null;

create index if not exists content_items_related_library_content_idx
  on public.content_items (related_library_content_id)
  where related_library_content_id is not null;
