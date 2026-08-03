-- Fix real: create or replace so identifica funcao por nome+TIPOS dos
-- parametros, nao so pelo nome. 0054 adicionou parametros novos com
-- default a 4 RPCs existentes, o que criou uma SEGUNDA sobrecarga (overload)
-- em vez de substituir a original - a assinatura antiga (sem os parametros
-- novos) ficou orfa no banco, nunca mais chamada pelo codigo (que sempre
-- passa todos os parametros nomeados), mas ainda existindo e confundindo a
-- geracao de tipos do Supabase (gerava um union de duas assinaturas).
-- Remove as 4 assinaturas antigas explicitamente.

drop function if exists public.resolve_notification_audience(text, uuid, uuid);
drop function if exists public.admin_estimate_notification_audience(text, uuid, uuid);
drop function if exists public.admin_create_notification_campaign(text, text, text, text, text, uuid, uuid, text, text, boolean, boolean);
drop function if exists public.admin_update_notification_campaign(uuid, text, text, text, text, text, uuid, uuid, text, text, boolean, boolean);
