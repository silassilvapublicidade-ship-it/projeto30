-- Module D: instrumentation for Dicas (tip cards) - zero events existed for
-- this area before this migration (confirmed by reading tips.service.ts:
-- getPublishedTips/getTipBySlug/getDownloadableTip never called
-- record_analytics_event). Three new event names, mirroring the same
-- resilient recordAnalyticsEvent() pattern already used for
-- challenge_catalog_viewed/challenge_detail_viewed - fired directly from the
-- Server Components/Route Handler that read tip content, not from a new
-- table or trigger.
--
-- analytics_events already has dedicated FK columns for its other entity
-- references (challenge_id, enrollment_id) rather than stuffing ids into
-- metadata - content_item_id follows the same pattern for consistency and a
-- real (indexable, joinable) foreign key instead of an untyped jsonb value.

alter table public.analytics_events
  add column if not exists content_item_id uuid references public.content_items(id) on delete set null;

comment on column public.analytics_events.content_item_id is
  'Set for tip_card_viewed/tip_card_opened/tip_card_downloaded. Null for '
  'every other event type, same optional-FK pattern as challenge_id/enrollment_id.';

create index if not exists analytics_events_content_item_idx
  on public.analytics_events (content_item_id)
  where content_item_id is not null;

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
      'enrollment_resumed',
      'tip_card_viewed',
      'tip_card_opened',
      'tip_card_downloaded'
    )
  );

-- Adding p_content_item_id changes the signature (7 args vs the existing
-- 6), so create or replace would add a second overload instead of truly
-- replacing it - drop the old one first, same reasoning as
-- journey_calculate_day in 0030.
drop function if exists public.record_analytics_event(text, uuid, uuid, jsonb, text, text);

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
  returning id into inserted_id;

  return inserted_id;
end;
$$;

-- Re-apply the same grants the original (dropped) 6-arg version had -
-- Postgres defaults a freshly created function to PUBLIC execute, which
-- would silently widen access if left unset.
revoke all on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid)
  from public, anon;
grant execute on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid)
  to authenticated;
