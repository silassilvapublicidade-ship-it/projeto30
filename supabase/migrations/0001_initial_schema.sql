create extension if not exists citext;
create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('user', 'moderator', 'admin', 'super_admin');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.user_status as enum ('active', 'suspended', 'deleted');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.challenge_status as enum ('draft', 'active', 'paused', 'ended', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.enrollment_status as enum ('active', 'paused', 'completed', 'abandoned', 'restarted');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.habit_type as enum (
    'boolean',
    'quantity',
    'duration',
    'text',
    'single_choice',
    'multiple_choice',
    'reading'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.daily_log_status as enum ('in_progress', 'finalized', 'missed', 'reopened');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.habit_log_status as enum ('pending', 'completed', 'not_applicable', 'skipped');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_status as enum ('scheduled', 'sent', 'read', 'failed', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  name text,
  display_name text,
  avatar_url text,
  city text,
  timezone text not null default 'America/Sao_Paulo',
  onboarding_completed boolean not null default false,
  role public.user_role not null default 'user',
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_email_length check (char_length(email::text) <= 320)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  notifications jsonb not null default '{"email": false, "in_app": true}'::jsonb,
  privacy jsonb not null default '{"journal_private": true}'::jsonb,
  share_defaults jsonb not null default '{"show_name": false, "show_photo": false, "show_points": true}'::jsonb,
  reduced_motion boolean not null default false,
  locale text not null default 'pt-BR',
  theme text not null default 'dark',
  reminder_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  duration_days integer not null check (duration_days between 1 and 366),
  start_date date,
  end_date date,
  enrollment_start date,
  enrollment_end date,
  status public.challenge_status not null default 'draft',
  theme_config jsonb not null default '{}'::jsonb,
  rules_config jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.challenge_days (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text,
  message text,
  theme text,
  unlock_rule jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, challenge_id),
  unique (challenge_id, day_number)
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  title text not null,
  description text,
  category text,
  habit_type public.habit_type not null default 'boolean',
  icon text,
  points integer not null default 10 check (points >= 0),
  is_required boolean not null default true,
  frequency_config jsonb not null default '{}'::jsonb,
  validation_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, challenge_id)
);

create table if not exists public.challenge_day_habits (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  challenge_day_id uuid not null,
  habit_id uuid not null,
  override_points integer check (override_points is null or override_points >= 0),
  override_description text,
  sort_order integer not null default 0,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_day_id, habit_id),
  foreign key (challenge_day_id, challenge_id)
    references public.challenge_days(id, challenge_id) on delete cascade,
  foreign key (habit_id, challenge_id)
    references public.habits(id, challenge_id) on delete cascade
);

create table if not exists public.challenge_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  personal_start_date date not null,
  current_day integer not null default 1 check (current_day > 0),
  status public.enrollment_status not null default 'active',
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  paused_at timestamptz,
  restarted_from_enrollment_id uuid references public.challenge_enrollments(id),
  points_total integer not null default 0 check (points_total >= 0),
  streak_current integer not null default 0 check (streak_current >= 0),
  streak_best integer not null default 0 check (streak_best >= 0),
  completion_percent numeric(5, 2) not null default 0 check (completion_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, challenge_id),
  unique (id, user_id, challenge_id)
);

create unique index if not exists challenge_enrollments_one_active_per_user_challenge
  on public.challenge_enrollments (user_id, challenge_id)
  where status in ('active', 'paused');

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  challenge_id uuid not null,
  challenge_day_id uuid not null,
  log_date date not null,
  status public.daily_log_status not null default 'in_progress',
  completion_percent numeric(5, 2) not null default 0 check (completion_percent between 0 and 100),
  points_earned integer not null default 0 check (points_earned >= 0),
  rules_snapshot jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  editable_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, enrollment_id),
  unique (id, challenge_id),
  unique (id, enrollment_id, challenge_id),
  unique (id, challenge_day_id),
  unique (enrollment_id, challenge_day_id),
  unique (enrollment_id, log_date),
  foreign key (enrollment_id, challenge_id)
    references public.challenge_enrollments(id, challenge_id) on delete cascade,
  foreign key (challenge_day_id, challenge_id)
    references public.challenge_days(id, challenge_id) on delete restrict
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null,
  challenge_day_id uuid not null,
  habit_id uuid not null,
  status public.habit_log_status not null default 'pending',
  value_json jsonb not null default '{}'::jsonb,
  note text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_log_id, habit_id),
  foreign key (daily_log_id, challenge_day_id)
    references public.daily_logs(id, challenge_day_id) on delete cascade,
  foreign key (challenge_day_id, habit_id)
    references public.challenge_day_habits(challenge_day_id, habit_id) on delete restrict
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  daily_log_id uuid not null unique,
  enrollment_id uuid not null,
  user_id uuid not null,
  content text,
  gratitude text,
  difficulty text,
  victory text,
  tomorrow_focus text,
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (daily_log_id, enrollment_id)
    references public.daily_logs(id, enrollment_id) on delete cascade,
  foreign key (enrollment_id, user_id)
    references public.challenge_enrollments(id, user_id) on delete cascade
);

create table if not exists public.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  enrollment_id uuid not null,
  challenge_id uuid not null,
  daily_log_id uuid,
  source_type text not null,
  source_id uuid,
  points integer not null,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (enrollment_id, user_id, challenge_id)
    references public.challenge_enrollments(id, user_id, challenge_id) on delete cascade,
  foreign key (daily_log_id, enrollment_id, challenge_id)
    references public.daily_logs(id, enrollment_id, challenge_id) on delete cascade
);

create index if not exists point_events_user_created_idx on public.point_events (user_id, created_at desc);
create index if not exists point_events_enrollment_idx on public.point_events (enrollment_id);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  icon text,
  image_url text,
  points_bonus integer not null default 0 check (points_bonus >= 0),
  rule_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, challenge_id)
);

create unique index if not exists achievements_scope_slug_unique
  on public.achievements (challenge_id, slug);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  enrollment_id uuid not null,
  challenge_id uuid not null,
  achievement_id uuid not null,
  unlocked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, enrollment_id, achievement_id),
  foreign key (enrollment_id, user_id, challenge_id)
    references public.challenge_enrollments(id, user_id, challenge_id) on delete cascade,
  foreign key (achievement_id, challenge_id)
    references public.achievements(id, challenge_id) on delete cascade
);

create table if not exists public.reading_plans (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reading_plans_one_active_per_challenge
  on public.reading_plans (challenge_id)
  where active;

create table if not exists public.reading_plan_items (
  id uuid primary key default gen_random_uuid(),
  reading_plan_id uuid not null references public.reading_plans(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  reference text not null,
  title text,
  summary text,
  reflection text,
  question text,
  external_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reading_plan_id, day_number, sort_order)
);

create table if not exists public.share_templates (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  preview_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, challenge_id)
);

create table if not exists public.share_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  enrollment_id uuid not null,
  challenge_id uuid not null,
  daily_log_id uuid not null,
  template_id uuid,
  image_url text,
  share_config jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  downloaded_at timestamptz,
  shared_at timestamptz,
  foreign key (enrollment_id, user_id, challenge_id)
    references public.challenge_enrollments(id, user_id, challenge_id) on delete cascade,
  foreign key (daily_log_id, enrollment_id, challenge_id)
    references public.daily_logs(id, enrollment_id, challenge_id) on delete cascade,
  foreign key (template_id, challenge_id)
    references public.share_templates(id, challenge_id) on delete restrict
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id) on delete cascade,
  type text not null,
  title text not null,
  slug text not null unique,
  excerpt text,
  body text,
  media_url text,
  status public.content_status not null default 'draft',
  published_at timestamptz,
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  channel text not null default 'in_app',
  status public.notification_status not null default 'scheduled',
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

drop trigger if exists set_challenges_updated_at on public.challenges;
create trigger set_challenges_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();

drop trigger if exists set_challenge_days_updated_at on public.challenge_days;
create trigger set_challenge_days_updated_at
  before update on public.challenge_days
  for each row execute function public.set_updated_at();

drop trigger if exists set_habits_updated_at on public.habits;
create trigger set_habits_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

drop trigger if exists set_challenge_day_habits_updated_at on public.challenge_day_habits;
create trigger set_challenge_day_habits_updated_at
  before update on public.challenge_day_habits
  for each row execute function public.set_updated_at();

drop trigger if exists set_challenge_enrollments_updated_at on public.challenge_enrollments;
create trigger set_challenge_enrollments_updated_at
  before update on public.challenge_enrollments
  for each row execute function public.set_updated_at();

drop trigger if exists set_daily_logs_updated_at on public.daily_logs;
create trigger set_daily_logs_updated_at
  before update on public.daily_logs
  for each row execute function public.set_updated_at();

drop trigger if exists set_habit_logs_updated_at on public.habit_logs;
create trigger set_habit_logs_updated_at
  before update on public.habit_logs
  for each row execute function public.set_updated_at();

drop trigger if exists set_journal_entries_updated_at on public.journal_entries;
create trigger set_journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

drop trigger if exists set_achievements_updated_at on public.achievements;
create trigger set_achievements_updated_at
  before update on public.achievements
  for each row execute function public.set_updated_at();

drop trigger if exists set_reading_plans_updated_at on public.reading_plans;
create trigger set_reading_plans_updated_at
  before update on public.reading_plans
  for each row execute function public.set_updated_at();

drop trigger if exists set_reading_plan_items_updated_at on public.reading_plan_items;
create trigger set_reading_plan_items_updated_at
  before update on public.reading_plan_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_share_templates_updated_at on public.share_templates;
create trigger set_share_templates_updated_at
  before update on public.share_templates
  for each row execute function public.set_updated_at();

drop trigger if exists set_content_items_updated_at on public.content_items;
create trigger set_content_items_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.users
      where id = auth.uid()
        and deleted_at is null
        and status = 'active'
      limit 1
    ),
    'user'::public.user_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'super_admin');
$$;

create or replace function public.owns_enrollment(target_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.challenge_enrollments
    where id = target_enrollment_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.owns_daily_log(target_daily_log_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.daily_logs dl
    join public.challenge_enrollments ce on ce.id = dl.enrollment_id
    where dl.id = target_daily_log_id
      and ce.user_id = auth.uid()
  );
$$;

create or replace function public.enforce_notification_user_read_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() is null or old.user_id is distinct from auth.uid() then
    raise exception 'Users can only mark their own notifications as read.'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.data is distinct from old.data
    or new.channel is distinct from old.channel
    or new.scheduled_at is distinct from old.scheduled_at
    or new.sent_at is distinct from old.sent_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Only notification read status can be changed by the owner.'
      using errcode = '42501';
  end if;

  if new.status is distinct from 'read'::public.notification_status then
    raise exception 'Notifications can only be marked as read by the owner.'
      using errcode = '42501';
  end if;

  new.read_at = coalesce(old.read_at, now());
  return new;
end;
$$;

drop trigger if exists enforce_notification_user_read_update on public.notifications;
create trigger enforce_notification_user_read_update
  before update on public.notifications
  for each row execute function public.enforce_notification_user_read_update();

alter table public.users enable row level security;
alter table public.user_preferences enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_days enable row level security;
alter table public.habits enable row level security;
alter table public.challenge_day_habits enable row level security;
alter table public.challenge_enrollments enable row level security;
alter table public.daily_logs enable row level security;
alter table public.habit_logs enable row level security;
alter table public.journal_entries enable row level security;
alter table public.point_events enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.reading_plans enable row level security;
alter table public.reading_plan_items enable row level security;
alter table public.share_templates enable row level security;
alter table public.share_cards enable row level security;
alter table public.content_items enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "Users can read own profile"
  on public.users for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "Admins can manage users"
  on public.users for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can manage own preferences"
  on public.user_preferences for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "Anyone can read active challenges"
  on public.challenges for select
  using (status = 'active' and deleted_at is null);

create policy "Admins can manage challenges"
  on public.challenges for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read active challenge days"
  on public.challenge_days for select
  using (
    exists (
      select 1 from public.challenges c
      where c.id = challenge_days.challenge_id
        and c.status = 'active'
        and c.deleted_at is null
    )
  );

create policy "Admins can manage challenge days"
  on public.challenge_days for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read active habits"
  on public.habits for select
  using (
    active
    and exists (
      select 1 from public.challenges c
      where c.id = habits.challenge_id
        and c.status = 'active'
        and c.deleted_at is null
    )
  );

create policy "Admins can manage habits"
  on public.habits for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read active day habits"
  on public.challenge_day_habits for select
  using (
    exists (
      select 1
      from public.challenge_days cd
      join public.challenges c on c.id = cd.challenge_id
      where cd.id = challenge_day_habits.challenge_day_id
        and c.status = 'active'
        and c.deleted_at is null
    )
  );

create policy "Admins can manage day habits"
  on public.challenge_day_habits for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own enrollments"
  on public.challenge_enrollments for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage enrollments"
  on public.challenge_enrollments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own daily logs"
  on public.daily_logs for select
  to authenticated
  using (public.owns_enrollment(enrollment_id) or public.is_admin());

create policy "Admins can manage daily logs"
  on public.daily_logs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own habit logs"
  on public.habit_logs for select
  to authenticated
  using (public.owns_daily_log(daily_log_id) or public.is_admin());

create policy "Admins can manage habit logs"
  on public.habit_logs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own journal entries"
  on public.journal_entries for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage journal entries"
  on public.journal_entries for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own point events"
  on public.point_events for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage point events"
  on public.point_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read active achievements"
  on public.achievements for select
  using (active);

create policy "Admins can manage achievements"
  on public.achievements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own achievements"
  on public.user_achievements for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage user achievements"
  on public.user_achievements for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read active reading plans"
  on public.reading_plans for select
  using (
    active
    and exists (
      select 1 from public.challenges c
      where c.id = reading_plans.challenge_id
        and c.status = 'active'
        and c.deleted_at is null
    )
  );

create policy "Admins can manage reading plans"
  on public.reading_plans for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read reading plan items"
  on public.reading_plan_items for select
  using (
    exists (
      select 1
      from public.reading_plans rp
      join public.challenges c on c.id = rp.challenge_id
      where rp.id = reading_plan_items.reading_plan_id
        and rp.active
        and c.status = 'active'
        and c.deleted_at is null
    )
  );

create policy "Admins can manage reading plan items"
  on public.reading_plan_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read active share templates"
  on public.share_templates for select
  using (active);

create policy "Admins can manage share templates"
  on public.share_templates for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own share cards"
  on public.share_cards for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admins can manage share cards"
  on public.share_cards for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Anyone can read published content"
  on public.content_items for select
  using (status = 'published');

create policy "Admins can manage content"
  on public.content_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users can read own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can mark own notifications read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'read');

create policy "Admins can manage notifications"
  on public.notifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can read audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using (public.is_admin());

create policy "Admins can insert audit logs"
  on public.admin_audit_logs for insert
  to authenticated
  with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.owns_enrollment(uuid) from public, anon, authenticated;
revoke execute on function public.owns_daily_log(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_notification_user_read_update() from public, anon, authenticated;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_enrollment(uuid) to authenticated;
grant execute on function public.owns_daily_log(uuid) to authenticated;
