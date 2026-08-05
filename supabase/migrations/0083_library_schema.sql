-- Biblioteca (Parte B) - substitui o placeholder /app/leitura, que dizia
-- "reserva o espaco" mas nunca tinha nenhum link em lugar nenhum
-- (confirmado na Auditoria Completa). reading_plans/reading_plan_items
-- (0001) NAO sao reaproveitadas: sao presas a um challenge_id especifico,
-- com itens numerados sequencialmente por dia - um modelo de "plano de
-- leitura de um desafio", incompativel com o pedido atual (conteudo
-- navegavel por pilar/categoria, nao amarrado a um unico desafio,
-- com fluxo de revisao/IA). Ficam intocadas, ainda sem uso.
--
-- "Nao usar JSON livre para campos centrais": todo bloco editorial e uma
-- coluna de texto propria. ai_generation_metadata e jsonb de proposito -
-- e METADADO de rastreamento (qual modelo, quando, parametros
-- sanitizados), nunca conteudo em si, e foi pedido nominalmente pelo
-- usuario com esse nome exato.
create table if not exists public.library_contents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  pillar text not null,
  category text,
  title text not null,
  subtitle text,
  summary text,
  introduction text,
  body text,
  practical_application text,
  reflection_question text,
  small_action text,
  final_message text,
  bible_reference text,
  bible_excerpt text,
  tags text[] not null default '{}',
  reading_time_minutes integer,
  difficulty text not null default 'beginner',
  status text not null default 'draft',
  source_type text not null default 'manual',
  ai_generation_status text,
  ai_generation_metadata jsonb not null default '{}'::jsonb,
  requires_enhanced_review boolean not null default false,
  related_challenge_id uuid references public.challenges(id) on delete set null,
  related_habit_id uuid references public.habits(id) on delete set null,
  cover_image_url text,
  cover_storage_path text,
  author_type text not null default 'admin',
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  published_by uuid references public.users(id) on delete set null,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_contents_pillar_check check (pillar in ('body', 'mind', 'character', 'spirit')),
  constraint library_contents_difficulty_check check (difficulty in ('beginner', 'intermediate', 'advanced')),
  constraint library_contents_status_check check (
    status in ('draft', 'in_review', 'approved', 'scheduled', 'published', 'archived')
  ),
  constraint library_contents_source_type_check check (source_type in ('manual', 'ai_assisted')),
  constraint library_contents_ai_status_check check (
    ai_generation_status is null
    or ai_generation_status in ('pending', 'generating', 'completed', 'failed', 'cancelled')
  ),
  constraint library_contents_author_type_check check (author_type in ('admin', 'ai_assisted')),
  constraint library_contents_title_length check (char_length(title) between 1 and 200),
  constraint library_contents_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists library_contents_status_idx on public.library_contents (status, published_at desc);
create index if not exists library_contents_pillar_idx on public.library_contents (pillar) where status = 'published';
create index if not exists library_contents_challenge_idx on public.library_contents (related_challenge_id) where related_challenge_id is not null;

drop trigger if exists set_library_contents_updated_at on public.library_contents;
create trigger set_library_contents_updated_at
  before update on public.library_contents
  for each row execute function public.set_updated_at();

alter table public.library_contents enable row level security;

create policy "Published library content is readable by any member"
  on public.library_contents for select
  to authenticated
  using (status = 'published' or public.is_admin());

create policy "Admins manage library content"
  on public.library_contents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.library_reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_id uuid not null references public.library_contents(id) on delete cascade,
  status text not null default 'not_started',
  progress_percent numeric(5, 2) not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_reading_progress_status_check check (status in ('not_started', 'reading', 'completed')),
  constraint library_reading_progress_percent_check check (progress_percent between 0 and 100),
  constraint library_reading_progress_unique unique (user_id, content_id)
);

drop trigger if exists set_library_reading_progress_updated_at on public.library_reading_progress;
create trigger set_library_reading_progress_updated_at
  before update on public.library_reading_progress
  for each row execute function public.set_updated_at();

alter table public.library_reading_progress enable row level security;

create policy "Users manage their own reading progress"
  on public.library_reading_progress for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Bucket de capas - publico (mesma logica de challenge-covers/tip-cards:
-- a imagem final e para ser vista por qualquer membro, sem sessao).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-covers', 'library-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "library_covers_public_select"
  on storage.objects for select
  using (bucket_id = 'library-covers');

create policy "library_covers_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'library-covers' and public.is_admin());

create policy "library_covers_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'library-covers' and public.is_admin())
  with check (bucket_id = 'library-covers' and public.is_admin());

create policy "library_covers_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'library-covers' and public.is_admin());
