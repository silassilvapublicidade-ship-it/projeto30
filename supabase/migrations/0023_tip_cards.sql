-- Fase: Cards de Dicas em imagem.
--
-- AUDITORIA (antes de criar qualquer tabela ou bucket novo)
-- public.content_items ja e a fonte oficial de Dicas desde 0011_tips_content.sql
-- (type = 'tip', com category e display_order ja adicionados naquela
-- migration). Colunas que faltam para o card visual: alt_text (acessibilidade
-- da imagem), starts_at/ends_at (janela de exibicao opcional). Title, slug,
-- excerpt (resumo), body (descricao), media_url (imagem), category, status
-- (draft/published/archived - ja bate exatamente com o pedido), display_order
-- e challenge_id ja existem. RLS de leitura (authenticated + published) e
-- escrita (is_admin(), todas as operacoes) tambem ja existem e ja cobrem os
-- requisitos de autorizacao desta rodada - nenhuma policy nova e necessaria
-- em content_items.
--
-- Nao ha bucket de imagem para conteudo generico - so existem "avatars"
-- (por usuario) e "challenge-covers" (por desafio). Cards de Dicas nao sao
-- nem um nem outro, entao seguem o MESMO padrao de challenge-covers
-- (0009_habit_frequency_and_challenge_media.sql): bucket proprio, leitura
-- publica, escrita restrita a admin/super_admin via public.is_admin().

alter table public.content_items
  add column if not exists alt_text text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

comment on column public.content_items.alt_text is
  'Texto alternativo da imagem do card (acessibilidade). Nulo cai para o '
  'title como alt no cliente.';
comment on column public.content_items.starts_at is
  'Card so aparece para usuarios a partir desta data/hora, alem de status = '
  'published. Nulo = sem inicio programado (aparece assim que publicado).';
comment on column public.content_items.ends_at is
  'Card deixa de aparecer para usuarios apos esta data/hora, mesmo com '
  'status = published. Nulo = sem fim programado.';

insert into storage.buckets (id, name, public)
values ('tip-cards', 'tip-cards', true)
on conflict (id) do nothing;

create policy "Tip cards are publicly readable"
  on storage.objects for select
  using (bucket_id = 'tip-cards');

create policy "Admins can manage tip cards"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'tip-cards' and public.is_admin())
  with check (bucket_id = 'tip-cards' and public.is_admin());
