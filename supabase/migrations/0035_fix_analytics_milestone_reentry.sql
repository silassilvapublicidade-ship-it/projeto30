-- Second bug found while validating the 0034 fix in production (real call,
-- real rollback-free test against the admin's own live Day 1 log): marking
-- a habit as completed, undoing it, then completing any habit again crashes
-- with:
--
--   ERROR: 23505: duplicate key value violates unique constraint
--   "analytics_events_enrollment_milestone_unique"
--   DETAIL: Key (enrollment_id, event_name)=(<enrollment>,
--   challenge_first_habit_completed) already exists.
--
-- Root cause: update_habit_log() (and join_specific_challenge/
-- finalize_daily_log the same way) decide whether to fire a milestone event
-- by recomputing a live condition (e.g. "exactly 1 habit_logs row with
-- status = completed for this enrollment") rather than by remembering that
-- the milestone already fired once. Undo+redo can make that live condition
-- become true again for an enrollment that already has the milestone
-- recorded (analytics_events_enrollment_milestone_unique,
-- 0015_analytics_events.sql, one row per (enrollment_id, event_name) for
-- the 6 milestone event names). record_analytics_event() had no ON CONFLICT
-- clause, so the second insert attempt raises 23505 - and because it's
-- called with `perform` (not wrapped in its own exception handler) inside a
-- security definer function that also just wrote the real habit_logs row,
-- the whole transaction (including that legitimate write) rolls back. A
-- second "Acao nao salva" trap, reachable by any normal mark/unmark/remark
-- sequence, not just the artificial repro used to find it.
--
-- Fix: record_analytics_event() becomes idempotent for exactly the 6
-- milestone event names, matching the partial unique index's own predicate
-- (enrollment_id, event_name) where enrollment_id is not null and
-- event_name in (...) - copied verbatim from the index definition so
-- Postgres accepts it as the ON CONFLICT arbiter. Every other event_name
-- (including the two Module D tip events, which have no such index) is
-- unaffected - the ON CONFLICT clause only matches rows that satisfy that
-- exact partial predicate. Callers that already log the record's id
-- (none currently do) would now sometimes receive an already-existing id or
-- null on a genuine duplicate suppression - out of scope here since no
-- caller reads the return value of a milestone-event call today.
create or replace function public.record_analytics_event(
  p_event_name text,
  p_challenge_id uuid default null,
  p_enrollment_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_session_id text default null,
  p_source text default 'client',
  p_content_item_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  inserted_id uuid;
begin
  if p_event_name is null or p_event_name not in (
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
    'enrollment_resumed',
    'tip_card_viewed',
    'tip_card_opened',
    'tip_card_downloaded'
  ) then
    raise exception 'Nome de evento nao permitido.'
      using errcode = '22023';
  end if;

  if p_source not in ('server', 'client') then
    raise exception 'Origem de evento invalida.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(normalized_metadata) <> 'object' then
    raise exception 'Metadata de evento precisa ser um objeto JSON.'
      using errcode = '22023';
  end if;

  insert into public.analytics_events (
    user_id, event_name, challenge_id, enrollment_id, content_item_id, metadata, session_id, source
  )
  values (
    actor_id, p_event_name, p_challenge_id, p_enrollment_id, p_content_item_id, normalized_metadata,
    nullif(trim(coalesce(p_session_id, '')), ''), p_source
  )
  on conflict (enrollment_id, event_name)
    where enrollment_id is not null
      and event_name in (
        'challenge_joined',
        'challenge_first_habit_completed',
        'challenge_day_7_reached',
        'challenge_halfway_reached',
        'challenge_completed',
        'challenge_abandoned'
      )
  do nothing
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid)
  from public, anon;
grant execute on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid)
  to authenticated;
