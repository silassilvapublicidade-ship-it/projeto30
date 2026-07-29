-- Fase 3: bucket e politicas de Storage para foto de perfil.
--
-- Auditoria previa: nao havia nenhum bucket criado (select * from
-- storage.buckets retornou vazio no projeto), entao nao ha padrao existente
-- para "reutilizar" - esta migration cria o primeiro.
--
-- Escolha: bucket publico para leitura. Fotos de perfil nao sao dado
-- sensivel (diferente do diario, que fica em journal_entries com RLS
-- privada), e leitura publica evita a complexidade de assinar URLs so para
-- exibir um avatar. Escrita/atualizacao/remocao continuam restritas ao
-- proprio dono do arquivo via RLS em storage.objects - a aplicacao nunca usa
-- service role no browser para isso.
--
-- Caminho do arquivo: avatars/{userId}/profile.<ext>. O {userId} vem sempre
-- de auth.uid() no servidor, nunca de entrada do cliente, entao um usuario
-- nunca consegue escrever no caminho de outro mesmo manipulando a chamada.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
