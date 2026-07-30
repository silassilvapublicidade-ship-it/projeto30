-- Fase 6 (parte 1/4): geracao de artes compartilhaveis de conquistas.
--
-- AUDITORIA PREVIA (antes de qualquer alteracao):
-- - public.share_templates e public.share_cards ja existem desde
--   0001_initial_schema.sql, com 0 linhas em cada uma (confirmado via
--   select count(*) no projeto remoto) - nao ha dado de producao em risco.
-- - share_cards ja tem: user_id, enrollment_id, challenge_id, daily_log_id
--   (todos not null), template_id (nullable), image_url, share_config,
--   generated_at, downloaded_at, shared_at. Foi desenhada apenas para cards
--   de PROGRESSO DIARIO (por isso daily_log_id e obrigatorio hoje).
-- - share_templates ja tem: challenge_id (not null), name, config jsonb,
--   preview_url, active.
-- - Nao existe hoje nenhuma coluna que amarre share_cards a uma conquista.
-- - migration 0012_achievement_sharing.sql ja documentou essa lacuna e
--   apontou exatamente o caminho seguido aqui: "share_cards precisaria de
--   uma coluna nova achievement_id uuid references achievements(id)
--   (nullable) - essa coluna NAO e criada nesta migration [0012]". Esta
--   migration [0014] e essa continuacao.
--
-- DECISOES DE SCHEMA (minimo necessario, nada removido):
--
-- 1) share_templates.challenge_id passa a ser NULLABLE. Motivo: os dois
--    presets oficiais desta fase (achievement_story, achievement_feed) sao
--    templates GLOBAIS, reutilizados por conquistas de QUALQUER desafio -
--    nao faz sentido duplicar a mesma configuracao visual uma vez por
--    desafio. challenge_id continua existindo e podendo ser preenchido no
--    futuro para um template especifico de um desafio (branding dedicado).
--
-- 2) Adicionado share_templates.slug (unique, nullable) - chave estavel para
--    o codigo da aplicacao localizar um preset por nome ("achievement_story"),
--    em vez de depender de um id gerado ou do "name" (que e apenas rotulo).
--    Mesmo padrao ja usado em challenges.slug e content_items.slug.
--
-- 3) A FK composta share_cards_template_id_challenge_id_fkey (template_id,
--    challenge_id) -> share_templates(id, challenge_id) e substituida por
--    uma FK simples (template_id) -> share_templates(id). A FK composta
--    original exigia que o challenge_id do card fosse IGUAL ao challenge_id
--    do template - impossivel de satisfazer para um template global (
--    challenge_id nulo) usado por conquistas de desafios diferentes.
--
-- 4) share_cards.daily_log_id passa a ser NULLABLE. Um card de conquista nao
--    se refere a um dia especifico (user_achievements nao guarda
--    daily_log_id) - so cards de progresso diario continuam exigindo-o. Uma
--    check constraint abaixo garante que todo card informe exatamente um
--    "ancora" valida (dia OU desbloqueio de conquista), nunca nenhuma.
--
-- 5) Novas colunas em share_cards:
--    - achievement_id (nullable, FK achievements.id): a conquista em si,
--      para filtragem/consulta (ex.: "todos os cards ja gerados para a
--      conquista X").
--    - user_achievement_id (nullable, FK user_achievements.id): o evento de
--      desbloqueio EXATO (usuario+inscricao+conquista+instante). Necessario
--      porque um usuario pode desbloquear a MESMA achievement_id de novo em
--      uma inscricao diferente (reinicio do mesmo desafio) - user_achievements
--      e quem desambigua isso, achievement_id sozinho nao.
--    - card_type (not null, default 'progress', check in
--      ('progress','achievement')): discriminador minimo. Nao existe hoje
--      nenhuma coluna que distinga os dois casos de forma extensivel (nem
--      mesmo "qual FK esta preenchida", pois o objetivo explicito desta fase
--      e permitir tipos futuros - conclusao de desafio, resumo semanal,
--      ranking - sem herdar um "if" por FK a cada tipo novo). Optou-se por
--      texto + check (em vez de um novo enum Postgres) porque adicionar um
--      valor a um enum exige uma migration propria e nao pode ser usado na
--      mesma transacao em que e criado - texto + check e mais simples de
--      estender em uma migration futura de uma linha so.
--    - template_version (not null, default 1): versao do LAYOUT do template
--      no momento da geracao. Incrementar este numero (em uma migration ou
--      update futuro) invalida os cards existentes desse template.
--    - payload_hash (nullable text): hash do conteudo textual/visual
--      efetivamente renderizado (nome da conquista, share_title/share_message,
--      nome de exibicao do usuario, template_version). Se o hash mudar
--      (usuario mudou o nome de exibicao, ou a conquista teve o
--      share_title/share_message editados, ou o template mudou de versao),
--      o card e regenerado; caso contrario, e reaproveitado.
--    - storage_path (nullable text): caminho exato do objeto no bucket
--      (para poder sobrescrever no lugar em vez de acumular arquivos orfaos
--      quando o card e regenerado).
--
-- 6) Indices: um indice simples em user_achievement_id (consulta comum), e
--    um indice UNICO (sem WHERE) em (user_achievement_id, template_id) - no
--    maximo um card por combinacao de desbloqueio+template, reforcando a
--    idempotencia no nivel do banco (a aplicacao faz upsert nesse par em vez
--    de inserir linhas novas a cada geracao). Deliberadamente NAO parcial:
--    Postgres so usa um indice unico parcial como alvo de ON CONFLICT se a
--    mesma clausula WHERE for repetida no INSERT, o que o cliente
--    supabase-js/PostgREST (.upsert({ onConflict: "..." })) nao permite
--    expressar. Um indice unico comum funciona igual para este caso: linhas
--    de card de progresso (user_achievement_id nulo) nunca colidem entre si
--    porque o Postgres trata cada NULL como distinto em indices unicos -
--    logo a restricao so tem efeito pratico quando user_achievement_id nao
--    e nulo, exatamente o comportamento desejado, sem precisar ser parcial.
--
-- 7) Bucket de Storage dedicado "achievement-share-cards" (nao reaproveita
--    "avatars" nem "challenge-covers" - convencao ja estabelecida no projeto
--    de um bucket por dominio, ver 0007 e 0009). Leitura publica (a imagem
--    final e o que sera compartilhado externamente, precisa ser acessivel
--    sem sessao). ESCRITA: nenhuma policy de insert/update/delete para
--    authenticated/anon - diferente do bucket "avatars" (onde o proprio
--    usuario grava sua pasta), aqui SOMENTE o backend grava, usando o
--    cliente service-role (createSupabaseAdminClient(), que ignora RLS por
--    definicao) depois de validar no servidor que a conquista pertence ao
--    usuario autenticado e esta desbloqueada. Nao ha necessidade de policy
--    alguma de escrita porque service-role nunca passa por RLS.
--
-- 8) Dois presets oficiais sao inseridos como seed idempotente
--    (on conflict do update): achievement_story (1080x1920) e
--    achievement_feed (1080x1350). O "config" jsonb documenta o formato
--    esperado (validado em TypeScript via Zod no server - ver
--    src/features/achievements/achievement-art.schemas.ts); o schema aqui
--    e apenas o formato de persistencia, a validacao de forma fica na
--    aplicacao.

alter table public.share_templates
  alter column challenge_id drop not null;

alter table public.share_templates
  add column if not exists slug text;

create unique index if not exists share_templates_slug_unique
  on public.share_templates (slug)
  where slug is not null;

alter table public.share_cards
  drop constraint if exists share_cards_template_id_challenge_id_fkey;

alter table public.share_cards
  add constraint share_cards_template_id_fkey
  foreign key (template_id) references public.share_templates(id) on delete restrict;

alter table public.share_cards
  alter column daily_log_id drop not null;

alter table public.share_cards
  add column if not exists achievement_id uuid references public.achievements(id) on delete cascade,
  add column if not exists user_achievement_id uuid references public.user_achievements(id) on delete cascade,
  add column if not exists card_type text not null default 'progress',
  add column if not exists template_version integer not null default 1,
  add column if not exists payload_hash text,
  add column if not exists storage_path text;

alter table public.share_cards
  drop constraint if exists share_cards_card_type_check;

alter table public.share_cards
  add constraint share_cards_card_type_check
  check (card_type in ('progress', 'achievement'));

alter table public.share_cards
  drop constraint if exists share_cards_anchor_check;

alter table public.share_cards
  add constraint share_cards_anchor_check
  check (
    (card_type = 'progress' and daily_log_id is not null)
    or (card_type = 'achievement' and user_achievement_id is not null)
  );

create index if not exists share_cards_user_achievement_idx
  on public.share_cards (user_achievement_id);

create index if not exists share_cards_achievement_idx
  on public.share_cards (achievement_id);

create unique index if not exists share_cards_user_achievement_template_unique
  on public.share_cards (user_achievement_id, template_id);

-- Bucket dedicado, leitura publica, escrita somente via service-role.
insert into storage.buckets (id, name, public)
values ('achievement-share-cards', 'achievement-share-cards', true)
on conflict (id) do nothing;

create policy "Achievement share cards are publicly readable"
  on storage.objects for select
  using (bucket_id = 'achievement-share-cards');

-- Presets oficiais (globais - challenge_id nulo). Config documentado em
-- src/features/achievements/achievement-art.schemas.ts (fonte de verdade
-- para validacao de forma); aqui e apenas o valor persistido.
insert into public.share_templates (slug, challenge_id, name, config, active)
values
  (
    'achievement_story',
    null,
    'Conquista - Story',
    jsonb_build_object(
      'width', 1080,
      'height', 1920,
      'format', 'story',
      'background', jsonb_build_object('type', 'gradient', 'from', '#1a0f00', 'to', '#3d1f00'),
      'accentColor', '#ff6a00',
      'textColor', '#ffffff',
      'showChallengeBranding', true,
      'showFooterSignature', true
    ),
    true
  ),
  (
    'achievement_feed',
    null,
    'Conquista - Feed',
    jsonb_build_object(
      'width', 1080,
      'height', 1350,
      'format', 'feed',
      'background', jsonb_build_object('type', 'gradient', 'from', '#1a0f00', 'to', '#3d1f00'),
      'accentColor', '#ff6a00',
      'textColor', '#ffffff',
      'showChallengeBranding', true,
      'showFooterSignature', true
    ),
    true
  )
on conflict (slug) where slug is not null do update
set
  config = excluded.config,
  active = excluded.active,
  updated_at = now();

comment on column public.share_cards.card_type is
  'Discriminador minimo do tipo de card. progress = card de progresso diario '
  '(daily_log_id obrigatorio); achievement = card de conquista desbloqueada '
  '(user_achievement_id obrigatorio). Novos tipos futuros (conclusao de '
  'desafio, resumo semanal, ranking) devem adicionar um novo valor aceito '
  'aqui via migration propria, com sua propria coluna de ancora nullable.';

comment on column public.share_cards.payload_hash is
  'Hash do conteudo efetivamente renderizado (texto + template_version). '
  'Mudou => regenerar; igual => reaproveitar o card existente.';
