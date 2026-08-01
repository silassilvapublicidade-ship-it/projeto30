-- Module C: schema + RLS groundwork for pausing/resuming/ending challenges
-- and individual enrollments. challenge_status already has 'paused'/'ended'
-- and enrollment_status already has 'paused' since 0001 - both have been
-- dormant (no RPC or admin action has ever set them). This migration only
-- adds what's actually missing; the next one (0030) adds the RPCs.
--
-- CRITICAL RLS FINDING (confirmed by reading, before writing anything):
-- "Anyone can read active challenges" only allows status = 'active'. Without
-- widening it, pausing a challenge would make public.challenges invisible
-- via RLS to every enrolled participant - not just blocking execution (the
-- actual goal), but breaking Hoje/Jornada entirely for them, since both join
-- challenges through the participant's own session-scoped client. Widened
-- to include 'paused' and 'ended' - 'draft' and 'archived' remain admin-only
-- reads, unchanged.

alter table public.challenges
  add column if not exists paused_at timestamptz,
  add column if not exists ended_at timestamptz;

comment on column public.challenges.paused_at is
  'Set while status = paused (whole-challenge pause). Cleared on resume. '
  'Used by admin_resume_challenge to compute how many days to credit back '
  'to every enrollment paused_days_offset, so participants never lose days '
  'to a pause window.';

comment on column public.challenges.ended_at is
  'Set once by admin_end_challenge. Ending is one-way from the admin UI - '
  'no "resume an ended challenge" action exists by design (brief: '
  '"nao permitir retomar sem acao especial").';

alter table public.challenge_enrollments
  add column if not exists paused_days_offset integer not null default 0
    check (paused_days_offset >= 0);

comment on column public.challenge_enrollments.paused_days_offset is
  'Cumulative whole days to subtract in journey_calculate_day so a pause '
  '(whole-challenge or this specific enrollment) never costs the '
  'participant real progress days. Incremented by admin_resume_challenge '
  '(bulk, one challenge) and admin_resume_enrollment (single row).';

drop policy if exists "Anyone can read active challenges" on public.challenges;

create policy "Anyone can read visible challenges"
  on public.challenges for select
  using (status in ('active', 'paused', 'ended') and deleted_at is null);

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check check (
    event_name in (
      'challenge_catalog_viewed',
      'challenge_detail_viewed',
      'challenge_join_clicked',
      'challenge_joined',
      'challenge_first_habit_completed',
      'challenge_day_completed',
      'challenge_day_7_reached',
      'challenge_halfway_reached',
      'challenge_completed',
      'challenge_abandoned',
      'share_achievement_started',
      'share_achievement_completed',
      'challenge_paused',
      'challenge_resumed',
      'challenge_ended',
      'enrollment_paused',
      'enrollment_resumed'
    )
  );
