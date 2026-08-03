-- Fase: Central de Notificacoes (F2) - bucket de imagens de campanha.
--
-- Segue o MESMO padrao de tip-cards (0023/0025): bucket proprio, leitura
-- publica (a imagem aparece no push/inbox do usuario, sem auth), escrita
-- restrita a admin/super_admin via public.is_admin(). file_size_limit e
-- allowed_mime_types configurados desde a criacao (nao como remendo
-- posterior) - defesa em profundidade identica a 0025_tip_cards_storage_
-- hardening.sql: mesmo que a validacao em app (validateTipImageUpload,
-- reaproveitada para campanhas) seja contornada, o proprio Storage rejeita
-- qualquer arquivo fora de 10 MB ou fora de image/jpeg, image/png,
-- image/webp - nunca SVG, GIF, PDF ou executaveis.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notification-images',
  'notification-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Notification images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'notification-images');

create policy "Admins can manage notification images"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'notification-images' and public.is_admin())
  with check (bucket_id = 'notification-images' and public.is_admin());
