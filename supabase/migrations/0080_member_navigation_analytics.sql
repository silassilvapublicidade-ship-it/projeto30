-- Reorganizacao definitiva da navegacao da area de membros - unico evento
-- novo necessario: visualizacao do hub /app/mais (Parte Q). Rastrear cada
-- clique em item (member_more_item_clicked) exigiria instrumentar ~15
-- links com onClick client-side sem necessidade comprovada ainda - fica de
-- fora deste round (ver comentario em analytics.service.ts).
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
      'tip_card_downloaded',
      'notification_campaign_created',
      'notification_campaign_scheduled',
      'notification_scheduled',
      'notification_sent',
      'notification_failed',
      'notification_opened',
      'notification_read',
      'notification_clicked',
      'push_permission_granted',
      'push_permission_denied',
      'push_subscription_created',
      'push_subscription_revoked',
      'daily_completion_summary_viewed',
      'daily_completion_continue_clicked',
      'daily_completion_journey_clicked',
      'daily_completion_share_clicked',
      'profile_dashboard_viewed',
      'profile_timeline_filter_changed',
      'profile_challenge_opened',
      'profile_achievement_shared',
      'profile_edit_clicked',
      'dashboard_mission_opened',
      'dashboard_continue_day_clicked',
      'dashboard_next_goal_clicked',
      'timeline_event_expanded',
      'evolution_share_started',
      'evolution_share_completed',
      'evolution_share_downloaded',
      'share_template_previewed',
      'dashboard_context_message_viewed',
      'admin_overview_viewed',
      'storage_audit_started',
      'storage_audit_completed',
      'storage_cleanup_completed',
      'error_retention_purge_completed',
      'feedback_form_opened',
      'feedback_submitted',
      'feedback_attachment_added',
      'feedback_admin_opened',
      'feedback_status_changed',
      'feedback_response_sent',
      'member_more_opened'
    )
  );

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
    'tip_card_downloaded',
    'notification_campaign_created',
    'notification_campaign_scheduled',
    'notification_scheduled',
    'notification_sent',
    'notification_failed',
    'notification_opened',
    'notification_read',
    'notification_clicked',
    'push_permission_granted',
    'push_permission_denied',
    'push_subscription_created',
    'push_subscription_revoked',
    'daily_completion_summary_viewed',
    'daily_completion_continue_clicked',
    'daily_completion_journey_clicked',
    'daily_completion_share_clicked',
    'profile_dashboard_viewed',
    'profile_timeline_filter_changed',
    'profile_challenge_opened',
    'profile_achievement_shared',
    'profile_edit_clicked',
    'dashboard_mission_opened',
    'dashboard_continue_day_clicked',
    'dashboard_next_goal_clicked',
    'timeline_event_expanded',
    'evolution_share_started',
    'evolution_share_completed',
    'evolution_share_downloaded',
    'share_template_previewed',
    'dashboard_context_message_viewed',
    'admin_overview_viewed',
    'storage_audit_started',
    'storage_audit_completed',
    'storage_cleanup_completed',
    'error_retention_purge_completed',
    'feedback_form_opened',
    'feedback_submitted',
    'feedback_attachment_added',
    'feedback_admin_opened',
    'feedback_status_changed',
    'feedback_response_sent',
    'member_more_opened'
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

revoke all on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid) from public, anon;
grant execute on function public.record_analytics_event(text, uuid, uuid, jsonb, text, text, uuid) to authenticated;
