-- A limpeza de arquivos orfaos (Parte A.6) deleta objetos reais do Storage
-- - uma chamada de API, nao uma linha de banco - entao nao ha "mutacao SQL"
-- para acoplar o insert de auditoria como nas outras RPCs deste projeto.
-- Esta funcao e so o registro: a exclusao real acontece em
-- storage-audit.service.ts com o client de service-role, DEPOIS de
-- revalidar cada arquivo; esta RPC e chamada em seguida, pelo mesmo
-- admin autenticado, para gravar o resultado em admin_audit_logs (nunca
-- o conteudo do arquivo - so bucket, paths, contagem, bytes, resultado).
create or replace function public.admin_log_storage_cleanup(
  p_bucket text,
  p_paths text[],
  p_deleted_count integer,
  p_freed_bytes bigint,
  p_result text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_actor_id uuid := auth.uid();
begin
  v_role := public.admin_require_admin();

  if v_role <> 'super_admin' then
    raise exception 'Apenas super administradores podem limpar arquivos de Storage.'
      using errcode = '42501';
  end if;

  if p_bucket is null or p_bucket not in (
    'avatars', 'challenge-covers', 'tip-cards', 'notification-images', 'achievement-share-cards'
  ) then
    raise exception 'Bucket nao permitido.' using errcode = '22023';
  end if;

  insert into public.admin_audit_logs (action, admin_user_id, entity_type, after_json)
  values (
    'admin_storage_cleanup',
    v_actor_id,
    'storage_object',
    jsonb_build_object(
      'bucket', p_bucket,
      'paths', p_paths,
      'deletedCount', p_deleted_count,
      'freedBytes', p_freed_bytes,
      'result', p_result
    )
  );
end;
$$;

revoke all on function public.admin_log_storage_cleanup(text, text[], integer, bigint, text) from public, anon;
grant execute on function public.admin_log_storage_cleanup(text, text[], integer, bigint, text) to authenticated;
