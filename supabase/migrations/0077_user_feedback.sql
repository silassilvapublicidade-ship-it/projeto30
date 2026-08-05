-- Feedback privado do usuario (Parte C do briefing de infraestrutura final).
--
-- Explicitamente NAO e um chat, NAO e uma central de tickets complexa: uma
-- tabela enxuta, RPCs security definer (mesmo padrao de system_error_events
-- em 0072/0073 - zero policy direta, redacao de campo sensivel feita DENTRO
-- da funcao conforme o papel do chamador), sem historico de status em tabela
-- separada (a trilha de quem mudou o que ja fica em admin_audit_logs).
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  protocol_code text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  feedback_type text not null,
  category text,
  title text not null,
  description text not null,
  sentiment text,
  status text not null default 'new',
  priority text not null default 'normal',
  route text,
  diagnostic_code text,
  app_version text,
  browser text,
  operating_system text,
  is_pwa boolean not null default false,
  viewport text,
  attachment_storage_path text,
  allow_contact boolean not null default false,
  admin_response text,
  internal_notes text,
  resolved_in_version text,
  responded_by uuid references public.users(id) on delete set null,
  responded_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_feedback_protocol_code_unique unique (protocol_code),
  constraint user_feedback_type_check check (feedback_type in ('problem', 'suggestion', 'rating')),
  constraint user_feedback_category_check check (
    category is null or category in (
      'nao_funcionou', 'erro_visual', 'nao_salvou', 'tela_nao_carregou', 'notificacao', 'compartilhamento', 'outro',
      'melhoria', 'conteudo', 'facilidade_uso', 'nova_ideia'
    )
  ),
  constraint user_feedback_sentiment_check check (sentiment is null or sentiment in ('positive', 'neutral', 'negative')),
  constraint user_feedback_status_check check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed')),
  constraint user_feedback_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint user_feedback_title_length check (char_length(title) between 1 and 200),
  constraint user_feedback_description_length check (char_length(description) between 1 and 4000)
);

create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id, created_at desc);
create index if not exists user_feedback_status_idx on public.user_feedback (status, created_at desc);
create index if not exists user_feedback_diagnostic_code_idx on public.user_feedback (diagnostic_code) where diagnostic_code is not null;

create trigger user_feedback_set_updated_at
  before update on public.user_feedback
  for each row execute function public.set_updated_at();

alter table public.user_feedback enable row level security;
-- Sem policies diretas: leitura/escrita somente via as RPCs abaixo, cada
-- uma decidindo o que o papel do chamador pode ver/alterar (mesmo padrao
-- de system_error_events).

-- Bucket privado (o PRIMEIRO privado do projeto - os outros 5 sao publicos
-- por design). Anexos de feedback podem conter capturas de tela reais do
-- usuario - nunca devem ter URL publica permanente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-feedback-attachments', 'user-feedback-attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "user_feedback_attachments_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-feedback-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "user_feedback_attachments_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-feedback-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "user_feedback_attachments_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-feedback-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- feedback e uma area nova de system_error_events (Parte F: instrumentar
-- SOMENTE falhas de envio/upload/resposta/vinculo, nunca o texto do
-- feedback em si).
alter table public.system_error_events
  drop constraint if exists system_error_events_area_check;

alter table public.system_error_events
  add constraint system_error_events_area_check check (
    area in (
      'auth', 'onboarding', 'desafios', 'habitos', 'finalizacao', 'conquistas',
      'compartilhamentos', 'dicas', 'uploads', 'notificacoes', 'cron', 'admin',
      'pwa', 'app', 'feedback'
    )
  );

-- Mesmo corpo de 0073 (fingerprint estavel = area+operation+postgres_code,
-- nunca a mensagem) - unica mudanca aditiva e a area nova 'feedback' na
-- whitelist, ja atualizada acima na constraint da tabela.
create or replace function public.record_system_error(
  p_area text,
  p_operation text,
  p_severity text,
  p_message_safe text,
  p_route text default null,
  p_postgres_code text default null,
  p_user_id uuid default null,
  p_metadata_safe jsonb default '{}'::jsonb,
  p_app_version text default null
)
returns table (error_code text, occurrence_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normalized_metadata jsonb := coalesce(p_metadata_safe, '{}'::jsonb);
  v_message text := left(trim(coalesce(p_message_safe, '')), 500);
  v_fingerprint text;
  v_error_code text;
  v_area_short text;
  v_row public.system_error_events%rowtype;
begin
  if p_area is null or p_area not in (
    'auth', 'onboarding', 'desafios', 'habitos', 'finalizacao', 'conquistas',
    'compartilhamentos', 'dicas', 'uploads', 'notificacoes', 'cron', 'admin',
    'pwa', 'app', 'feedback'
  ) then
    raise exception 'Area de erro invalida.' using errcode = '22023';
  end if;

  if p_severity not in ('info', 'warning', 'error', 'critical') then
    raise exception 'Severidade invalida.' using errcode = '22023';
  end if;

  if v_message = '' then
    raise exception 'Mensagem do erro e obrigatoria.' using errcode = '22023';
  end if;

  if p_operation is null or trim(p_operation) = '' then
    raise exception 'Operacao e obrigatoria.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_normalized_metadata) <> 'object' then
    raise exception 'Metadata precisa ser um objeto JSON.' using errcode = '22023';
  end if;

  if octet_length(v_normalized_metadata::text) > 2000 then
    raise exception 'Metadata excede o tamanho permitido.' using errcode = '22023';
  end if;

  if not public._system_error_text_is_safe(v_message)
    or not public._system_error_text_is_safe(v_normalized_metadata::text)
    or not public._system_error_text_is_safe(p_operation)
  then
    raise exception 'Conteudo do evento contem um padrao nao permitido.' using errcode = '22023';
  end if;

  v_area_short := upper(left(regexp_replace(p_area, '[^a-zA-Z]', '', 'g'), 5));
  v_fingerprint := md5(p_area || ':' || p_operation || ':' || coalesce(p_postgres_code, ''));
  v_error_code := 'P30-' || v_area_short || '-' || to_char(now(), 'YYYYMMDD') || '-' || upper(left(v_fingerprint, 4));

  insert into public.system_error_events as see (
    error_code, fingerprint, area, operation, severity, message_safe, route,
    postgres_code, user_id, metadata_safe, app_version
  )
  values (
    v_error_code, v_fingerprint, p_area, p_operation, p_severity, v_message, p_route,
    p_postgres_code, p_user_id, v_normalized_metadata, p_app_version
  )
  on conflict (fingerprint) do update set
    occurrence_count = see.occurrence_count + 1,
    last_seen_at = now(),
    severity = excluded.severity,
    message_safe = excluded.message_safe,
    route = excluded.route,
    user_id = coalesce(excluded.user_id, see.user_id),
    metadata_safe = excluded.metadata_safe,
    app_version = excluded.app_version
  returning see.* into v_row;

  return query select v_row.error_code, v_row.occurrence_count;
end;
$$;

revoke execute on function public.record_system_error(text, text, text, text, text, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_system_error(text, text, text, text, text, text, uuid, jsonb, text) to service_role;

-- ---------------------------------------------------------------------
-- RPCs de user_feedback
-- ---------------------------------------------------------------------

create or replace function public.create_user_feedback(
  p_id uuid,
  p_feedback_type text,
  p_category text,
  p_title text,
  p_description text,
  p_sentiment text default null,
  p_allow_contact boolean default false,
  p_include_technical boolean default true,
  p_route text default null,
  p_diagnostic_code text default null,
  p_app_version text default null,
  p_browser text default null,
  p_operating_system text default null,
  p_is_pwa boolean default false,
  p_viewport text default null,
  p_attachment_storage_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_description text := trim(coalesce(p_description, ''));
  v_protocol text;
  v_attempt integer := 0;
begin
  if v_user_id is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  if p_feedback_type not in ('problem', 'suggestion', 'rating') then
    raise exception 'Tipo de feedback invalido.' using errcode = '22023';
  end if;

  if v_title = '' or char_length(v_title) > 200 then
    raise exception 'Titulo invalido.' using errcode = '22023';
  end if;

  if v_description = '' or char_length(v_description) > 4000 then
    raise exception 'Descricao invalida.' using errcode = '22023';
  end if;

  if p_attachment_storage_path is not null
     and (storage.foldername(p_attachment_storage_path))[1] <> v_user_id::text then
    raise exception 'Caminho de anexo invalido.' using errcode = '22023';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_protocol := 'P30-FBK-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));

    begin
      insert into public.user_feedback (
        id, protocol_code, user_id, feedback_type, category, title, description, sentiment,
        allow_contact, route, diagnostic_code, app_version, browser, operating_system, is_pwa,
        viewport, attachment_storage_path
      )
      values (
        coalesce(p_id, gen_random_uuid()), v_protocol, v_user_id, p_feedback_type,
        nullif(trim(coalesce(p_category, '')), ''), v_title, v_description,
        nullif(trim(coalesce(p_sentiment, '')), ''), coalesce(p_allow_contact, false),
        case when p_include_technical then nullif(trim(coalesce(p_route, '')), '') else null end,
        case when p_include_technical then nullif(trim(coalesce(p_diagnostic_code, '')), '') else null end,
        case when p_include_technical then p_app_version else null end,
        case when p_include_technical then p_browser else null end,
        case when p_include_technical then p_operating_system else null end,
        case when p_include_technical then coalesce(p_is_pwa, false) else false end,
        case when p_include_technical then p_viewport else null end,
        p_attachment_storage_path
      );
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  return jsonb_build_object('id', coalesce(p_id, v_user_id), 'protocolCode', v_protocol);
end;
$$;

revoke all on function public.create_user_feedback(uuid, text, text, text, text, text, boolean, boolean, text, text, text, text, text, boolean, text, text) from public, anon;
grant execute on function public.create_user_feedback(uuid, text, text, text, text, text, boolean, boolean, text, text, text, text, text, boolean, text, text) to authenticated;

create or replace function public.user_list_my_feedback(p_limit integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user_id is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(f) order by f.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select id, protocol_code, feedback_type, category, title, status, sentiment,
           admin_response, resolved_in_version, created_at, responded_at, resolved_at
    from public.user_feedback
    where user_id = v_user_id
    order by created_at desc
    limit greatest(least(coalesce(p_limit, 20), 50), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  ) f;

  return v_rows;
end;
$$;

revoke all on function public.user_list_my_feedback(integer, integer) from public, anon;
grant execute on function public.user_list_my_feedback(integer, integer) to authenticated;

create or replace function public.user_withdraw_feedback(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise exception 'Autenticacao necessaria.' using errcode = '42501';
  end if;

  update public.user_feedback
  set status = 'closed'
  where id = p_id and user_id = v_user_id and status = 'new';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.user_withdraw_feedback(uuid) from public, anon;
grant execute on function public.user_withdraw_feedback(uuid) to authenticated;

create or replace function public.admin_list_user_feedback(
  p_search text default null,
  p_feedback_type text default null,
  p_category text default null,
  p_status text default null,
  p_priority text default null,
  p_has_attachment boolean default null,
  p_has_diagnostic boolean default null,
  p_period_start timestamptz default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
  v_total integer;
begin
  perform public.admin_require_admin();

  select count(*) into v_total
  from public.user_feedback f
  where (p_search is null or f.title ilike '%' || p_search || '%' or f.protocol_code ilike '%' || p_search || '%')
    and (p_feedback_type is null or f.feedback_type = p_feedback_type)
    and (p_category is null or f.category = p_category)
    and (p_status is null or f.status = p_status)
    and (p_priority is null or f.priority = p_priority)
    and (p_has_attachment is null or (f.attachment_storage_path is not null) = p_has_attachment)
    and (p_has_diagnostic is null or (f.diagnostic_code is not null) = p_has_diagnostic)
    and (p_period_start is null or f.created_at >= p_period_start);

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      f.id, f.protocol_code, f.feedback_type, f.category, f.title, f.status, f.priority,
      f.created_at, f.diagnostic_code, f.app_version, f.attachment_storage_path is not null as has_attachment,
      u.display_name as user_display_name
    from public.user_feedback f
    join public.users u on u.id = f.user_id
    where (p_search is null or f.title ilike '%' || p_search || '%' or f.protocol_code ilike '%' || p_search || '%')
      and (p_feedback_type is null or f.feedback_type = p_feedback_type)
      and (p_category is null or f.category = p_category)
      and (p_status is null or f.status = p_status)
      and (p_priority is null or f.priority = p_priority)
      and (p_has_attachment is null or (f.attachment_storage_path is not null) = p_has_attachment)
      and (p_has_diagnostic is null or (f.diagnostic_code is not null) = p_has_diagnostic)
      and (p_period_start is null or f.created_at >= p_period_start)
    order by f.created_at desc
    limit greatest(least(coalesce(p_limit, 20), 50), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

revoke all on function public.admin_list_user_feedback(text, text, text, text, text, boolean, boolean, timestamptz, integer, integer) from public, anon;
grant execute on function public.admin_list_user_feedback(text, text, text, text, text, boolean, boolean, timestamptz, integer, integer) to authenticated;

create or replace function public.admin_get_user_feedback_detail(p_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
begin
  perform public.admin_require_admin();

  select jsonb_build_object(
    'id', f.id,
    'protocolCode', f.protocol_code,
    'userId', f.user_id,
    'userDisplayName', u.display_name,
    'feedbackType', f.feedback_type,
    'category', f.category,
    'title', f.title,
    'description', f.description,
    'sentiment', f.sentiment,
    'status', f.status,
    'priority', f.priority,
    'route', f.route,
    'diagnosticCode', f.diagnostic_code,
    'appVersion', f.app_version,
    'browser', f.browser,
    'operatingSystem', f.operating_system,
    'isPwa', f.is_pwa,
    'viewport', f.viewport,
    'attachmentStoragePath', f.attachment_storage_path,
    'allowContact', f.allow_contact,
    'adminResponse', f.admin_response,
    'internalNotes', f.internal_notes,
    'resolvedInVersion', f.resolved_in_version,
    'respondedAt', f.responded_at,
    'resolvedAt', f.resolved_at,
    'createdAt', f.created_at,
    'updatedAt', f.updated_at,
    'linkedErrorEventCount', (
      select count(*) from public.system_error_events e
      where f.diagnostic_code is not null and e.error_code = f.diagnostic_code
    )
  )
  into v_row
  from public.user_feedback f
  join public.users u on u.id = f.user_id
  where f.id = p_id;

  return v_row;
end;
$$;

revoke all on function public.admin_get_user_feedback_detail(uuid) from public, anon;
grant execute on function public.admin_get_user_feedback_detail(uuid) to authenticated;

create or replace function public.admin_update_user_feedback(
  p_id uuid,
  p_status text default null,
  p_priority text default null,
  p_admin_response text default null,
  p_internal_notes text default null,
  p_resolved_in_version text default null,
  p_diagnostic_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_before jsonb;
  v_updated integer;
begin
  perform public.admin_require_admin();

  if p_status is not null and p_status not in ('new', 'reviewing', 'planned', 'resolved', 'closed') then
    raise exception 'Status invalido.' using errcode = '22023';
  end if;

  if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Prioridade invalida.' using errcode = '22023';
  end if;

  select jsonb_build_object('status', status, 'priority', priority) into v_before
  from public.user_feedback where id = p_id;

  update public.user_feedback
  set
    status = coalesce(p_status, status),
    priority = coalesce(p_priority, priority),
    admin_response = coalesce(p_admin_response, admin_response),
    internal_notes = coalesce(p_internal_notes, internal_notes),
    resolved_in_version = coalesce(p_resolved_in_version, resolved_in_version),
    diagnostic_code = coalesce(nullif(trim(coalesce(p_diagnostic_code, '')), ''), diagnostic_code),
    responded_by = case when p_admin_response is not null then v_actor_id else responded_by end,
    responded_at = case when p_admin_response is not null then now() else responded_at end,
    resolved_at = case when p_status = 'resolved' and status <> 'resolved' then now() else resolved_at end
  where id = p_id;

  get diagnostics v_updated = row_count;

  if v_updated > 0 then
    insert into public.admin_audit_logs (action, admin_user_id, entity_type, entity_id, before_json, after_json)
    values (
      'admin_update_user_feedback', v_actor_id, 'user_feedback', p_id, v_before,
      jsonb_build_object('status', p_status, 'priority', p_priority)
    );
  end if;

  return v_updated > 0;
end;
$$;

revoke all on function public.admin_update_user_feedback(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_user_feedback(uuid, text, text, text, text, text, text) to authenticated;

create or replace function public.admin_delete_user_feedback(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_actor_id uuid := auth.uid();
  v_attachment_path text;
begin
  v_role := public.admin_require_admin();

  if v_role <> 'super_admin' then
    raise exception 'Apenas super administradores podem excluir feedback definitivamente.'
      using errcode = '42501';
  end if;

  select attachment_storage_path into v_attachment_path
  from public.user_feedback where id = p_id;

  delete from public.user_feedback where id = p_id;

  insert into public.admin_audit_logs (action, admin_user_id, entity_type, entity_id, after_json)
  values ('admin_delete_user_feedback', v_actor_id, 'user_feedback', p_id, '{}'::jsonb);

  return v_attachment_path;
end;
$$;

revoke all on function public.admin_delete_user_feedback(uuid) from public, anon;
grant execute on function public.admin_delete_user_feedback(uuid) to authenticated;

create or replace function public.admin_count_feedback_for_diagnostic(p_error_code text)
returns integer
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select count(*)::integer from public.user_feedback where diagnostic_code = p_error_code;
$$;

revoke all on function public.admin_count_feedback_for_diagnostic(text) from public, anon;
grant execute on function public.admin_count_feedback_for_diagnostic(text) to authenticated;

-- Analytics (Parte G) - eventos de feedback, somente metadados.
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
      'feedback_response_sent'
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
    'feedback_response_sent'
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
