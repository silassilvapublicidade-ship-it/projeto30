-- Fase: reconstrucao completa dos Cards de Dicas em imagem (parte 2/2).
--
-- O bucket tip-cards (0023) nao tinha file_size_limit nem
-- allowed_mime_types configurados no Postgres - toda a validacao de
-- tamanho/MIME dependia inteiramente do codigo da aplicacao
-- (validateTipImageUpload). Isso e reforcado aqui como defesa em
-- profundidade: mesmo que a validacao da aplicacao seja contornada
-- (bug futuro, chamada direta a API do Storage), o proprio Supabase
-- Storage agora rejeita qualquer upload fora de 10 MB ou fora de
-- image/jpeg, image/png, image/webp - SVG, GIF, PDF e executaveis nunca
-- passam, nao importa a origem da chamada.

update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'tip-cards';
