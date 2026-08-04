-- Correcoes obrigatorias pre-lancamento (Parte B) - o lembrete diario
-- prometido no onboarding nunca se concretizava por 2 motivos:
-- 1) completeOnboardingAction (member.actions.ts) salvava reminder_time mas
--    nunca ligava notifications.daily_reminder_enabled (permanecia false,
--    o default de 0041) - corrigido no lado da aplicacao, sem migration.
-- 2) automation_resolve_daily_reminder_audience() (0048), mesmo quando
--    daily_reminder_enabled=true, NUNCA lia user_preferences.reminder_time -
--    so verificava se a hora local estava numa janela fixa 7-21h. O
--    horario escolhido pelo usuario era dado morto.
--
-- Este arquivo corrige (2), reaproveitando a MESMA funcao/assinatura via
-- create or replace (nunca editando 0048 aplicada). Continua elegivel so
-- dentro da janela geral 7-21h (guarda contra horarios absurdos e unico
-- jeito de garantir que o cron diario unico do Vercel Hobby - 09:00
-- America/Sao_Paulo, ver vercel.json - ainda capture a maioria dos
-- usuarios), mas agora SO fica elegivel depois que a hora local do usuario
-- ja alcancou o reminder_time escolhido (nunca antes). Quando
-- reminder_time e nulo (usuario ativou o lembrete por outro caminho sem
-- escolher horario - nao deveria acontecer via UI, mas o resolver nunca
-- deve quebrar por isso), cai de volta na janela 7-21h de sempre.
--
-- Limitacao real e documentada (nao escondida): como o cron do Vercel
-- Hobby roda so 1x/dia as 09:00 BRT, um usuario com reminder_time apos as
-- ~09:00 so recebe o lembrete no dia em que esse unico disparo acontecer
-- se um pinger externo mais frequente estiver configurado (o proprio
-- comentario de src/app/api/cron/notifications/process/route.ts ja
-- documenta essa possibilidade, nao verificada como ativa neste ambiente).
-- Nao alterar a arquitetura de notificacoes/cron esta fora do escopo desta
-- rodada.

create or replace function public.automation_resolve_daily_reminder_audience()
returns table (local_date date, push_eligible boolean, user_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
    select distinct
      loc.local_date,
      exists (
        select 1 from public.push_subscriptions ps
        where ps.user_id = u.id and ps.revoked_at is null
      ) and coalesce((up.notifications ->> 'push_enabled')::boolean, false),
      u.id
    from public.challenge_enrollments ce
    join public.users u on u.id = ce.user_id
    join public.challenges c on c.id = ce.challenge_id
    join public.user_preferences up on up.user_id = u.id
    cross join lateral (
      select
        public.journey_get_local_date(u.timezone) as local_date,
        (timezone(coalesce(nullif(u.timezone, ''), 'America/Sao_Paulo'), now()))::time as local_time
    ) loc
    where ce.status = 'active'
      and c.status = 'active'
      and c.deleted_at is null
      and u.status = 'active'
      and u.deleted_at is null
      and coalesce((up.notifications ->> 'daily_reminder_enabled')::boolean, false)
      and extract(hour from loc.local_time) between 7 and 21
      and (up.reminder_time is null or loc.local_time >= up.reminder_time)
      and not exists (
        select 1 from public.daily_logs dl
        where dl.enrollment_id = ce.id
          and dl.log_date = loc.local_date
          and dl.status = 'finalized'
      );
end;
$$;

revoke all on function public.automation_resolve_daily_reminder_audience() from public, anon, authenticated;
grant execute on function public.automation_resolve_daily_reminder_audience() to service_role;

comment on function public.automation_resolve_daily_reminder_audience() is
  'Publico do lembrete diario automatico. Elegivel so quando '
  'daily_reminder_enabled=true E a hora local do usuario ja alcancou '
  'reminder_time (nunca antes) E ainda esta dentro da janela geral 7-21h E '
  'o dia de hoje ainda nao foi finalizado. reminder_time nulo cai de volta '
  'na janela 7-21h inteira (nunca quebra por falta de horario).';
