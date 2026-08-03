-- Fix: 0054 introduziu resolve_notification_audience_combined com um
-- p_combined_min_streak DISTINTO de p_min_streak, mas as 3 RPCs que
-- deveriam usa-lo (estimate/create/update) chamavam a combinacao sempre com
-- null nesse parametro - o filtro de "segmentacao combinada" (Parte 11,
-- ultimo item) nunca era aplicado de verdade. Correcao: o mesmo valor
-- armazenado (min_streak_threshold / p_min_streak) agora e passado nos DOIS
-- parametros - serve como filtro base quando audience_type =
-- 'streak_above_threshold' (redundante consigo mesmo, inofensivo) E como
-- intersecao extra para QUALQUER outro audience_type (o comportamento real
-- pedido), sem precisar de uma segunda coluna/campo de formulario.

create or replace function public.admin_estimate_notification_audience(
  p_audience_type text,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_min_streak integer default null,
  p_habit_keyword text default null
)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  perform public.admin_require_admin();

  select count(*) into v_count
  from public.resolve_notification_audience_combined(
    p_audience_type, p_challenge_id, p_specific_user_id, p_min_streak, p_habit_keyword, p_min_streak
  );

  return v_count;
end;
$$;

create or replace function public.admin_create_notification_campaign(
  p_title text,
  p_message text,
  p_destination_type text,
  p_audience_type text,
  p_destination_reference_id text default null,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_image_url text default null,
  p_action_label text default null,
  p_channel_internal boolean default true,
  p_channel_push boolean default true,
  p_min_streak_threshold integer default null,
  p_habit_keyword text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  v_id uuid;
  v_estimate integer;
begin
  perform public.admin_require_admin();

  if actor_id is null then
    raise exception 'Sessao necessaria.' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 or length(p_title) > 120 then
    raise exception 'Titulo invalido.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_message, ''))) = 0 or length(p_message) > 500 then
    raise exception 'Mensagem invalida.' using errcode = '22023';
  end if;

  if not p_channel_internal and not p_channel_push then
    raise exception 'Selecione ao menos um canal.' using errcode = '22023';
  end if;

  select count(*) into v_estimate
  from public.resolve_notification_audience_combined(
    p_audience_type, p_challenge_id, p_specific_user_id, p_min_streak_threshold, p_habit_keyword, p_min_streak_threshold
  );

  insert into public.notification_campaigns (
    action_label, audience_estimated_count, audience_type, challenge_id, channel_internal,
    channel_push, created_by, destination_reference_id, destination_type, image_url, message,
    source, specific_user_id, status, title, min_streak_threshold, habit_keyword
  )
  values (
    nullif(trim(coalesce(p_action_label, '')), ''), v_estimate, p_audience_type, p_challenge_id,
    p_channel_internal, p_channel_push, actor_id, nullif(trim(coalesce(p_destination_reference_id, '')), ''),
    p_destination_type, nullif(trim(coalesce(p_image_url, '')), ''), p_message, 'admin', p_specific_user_id,
    'draft', p_title, p_min_streak_threshold, nullif(trim(coalesce(p_habit_keyword, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_update_notification_campaign(
  p_campaign_id uuid,
  p_title text,
  p_message text,
  p_destination_type text,
  p_audience_type text,
  p_destination_reference_id text default null,
  p_challenge_id uuid default null,
  p_specific_user_id uuid default null,
  p_image_url text default null,
  p_action_label text default null,
  p_channel_internal boolean default true,
  p_channel_push boolean default true,
  p_min_streak_threshold integer default null,
  p_habit_keyword text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_estimate integer;
begin
  perform public.admin_require_admin();

  select status into v_status from public.notification_campaigns where id = p_campaign_id for update;

  if v_status is null then
    raise exception 'Campanha nao encontrada.' using errcode = 'P0002';
  end if;

  if v_status <> 'draft' then
    raise exception 'Apenas campanhas em rascunho podem ser editadas.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_title, ''))) = 0 or length(p_title) > 120 then
    raise exception 'Titulo invalido.' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_message, ''))) = 0 or length(p_message) > 500 then
    raise exception 'Mensagem invalida.' using errcode = '22023';
  end if;

  if not p_channel_internal and not p_channel_push then
    raise exception 'Selecione ao menos um canal.' using errcode = '22023';
  end if;

  select count(*) into v_estimate
  from public.resolve_notification_audience_combined(
    p_audience_type, p_challenge_id, p_specific_user_id, p_min_streak_threshold, p_habit_keyword, p_min_streak_threshold
  );

  update public.notification_campaigns
  set action_label = nullif(trim(coalesce(p_action_label, '')), ''),
      audience_estimated_count = v_estimate,
      audience_type = p_audience_type,
      challenge_id = p_challenge_id,
      channel_internal = p_channel_internal,
      channel_push = p_channel_push,
      destination_reference_id = nullif(trim(coalesce(p_destination_reference_id, '')), ''),
      destination_type = p_destination_type,
      image_url = nullif(trim(coalesce(p_image_url, '')), ''),
      message = p_message,
      specific_user_id = p_specific_user_id,
      title = p_title,
      min_streak_threshold = p_min_streak_threshold,
      habit_keyword = nullif(trim(coalesce(p_habit_keyword, '')), '')
  where id = p_campaign_id;
end;
$$;

comment on function public.admin_estimate_notification_audience(text, uuid, uuid, integer, text) is
  'p_min_streak agora tambem alimenta p_combined_min_streak na chamada '
  'interna - a estimativa exibida no compositor nunca diverge do envio '
  'real (processNotificationCampaign faz a mesma chamada dupla).';
