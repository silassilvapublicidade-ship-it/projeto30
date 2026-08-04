-- Corrige record_system_error (0072): o fingerprint original incluia os
-- primeiros 100 caracteres da mensagem. Como muitas mensagens carregam
-- detalhes dinamicos reais (ex.: "Cron executado: 3 campanhas, 12
-- deliveries..." vs "2 campanhas, 8 deliveries..."), duas ocorrencias do
-- MESMO erro/execucao geravam fingerprints diferentes - uma linha nova a
-- cada vez, exatamente o que a Parte K probe explicitamente contra
-- ("nunca uma linha nova para o mesmo erro repetido"). Encontrado em
-- validacao funcional antes de qualquer commit/deploy.
--
-- Correcao: fingerprint passa a depender so de area + operation +
-- postgres_code (identidade estavel do site de falha), nunca do texto da
-- mensagem. O texto continua livre/descritivo porque nao participa mais do
-- agrupamento. Quem integra recordSystemError() deve usar um `operation`
-- estavel (ex. "achievement_card_render", nunca um valor dinamico).
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
    'pwa', 'app'
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
  -- Estavel: nunca depende do texto da mensagem (ver comentario acima).
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
