-- Parte G/23 - remove as RPCs de jornada substituidas pelo fluxo de
-- finalizacao em lote (finalize_daily_log_with_responses, migration 0037+).
--
-- RE-VERIFICACAO FEITA NESTA RODADA antes de tocar em qualquer coisa
-- (nunca remover so por estar "provavelmente" morta):
--   1. Busca exaustiva em src/ por "update_habit_log" e "finalize_daily_log"
--      (nome exato, nao "finalize_daily_log_with_responses") - zero
--      chamadas .rpc() em codigo de producao. Os unicos hits sao um teste
--      de regressao (update-habit-log-regression.test.ts) que le o TEXTO
--      da migration 0034/0035 para travar aquele fix historico - nunca
--      chama a funcao de verdade, entao continua passando sem ela existir.
--   2. Busca em TODAS as migrations por uma chamada SQL interna
--      (perform/select update_habit_log(...) ou finalize_daily_log(...)
--      de dentro de outra funcao) - zero ocorrencias. Ambas sao RPCs-folha,
--      nunca helpers internos de outra RPC.
--   3. Confirmado que finalize_daily_log_with_responses (ultima definicao:
--      migration 0059) nao referencia nenhuma das duas.
--
-- source_type/author_type deste comentario: decisao explicita do usuario
-- (Parte 23) - revoga o EXECUTE de authenticated e derruba a funcao, ja
-- que nao ha nenhuma dependencia comprovada. Nunca edita as migrations
-- originais (0002...0036) - elas continuam descrevendo fielmente o que foi
-- aplicado naquele momento; esta migration so encerra o ciclo de vida das
-- duas funcoes a partir de agora.
revoke all on function public.update_habit_log(
  uuid, uuid, public.habit_log_status, jsonb, text
) from public, anon, authenticated;
drop function if exists public.update_habit_log(
  uuid, uuid, public.habit_log_status, jsonb, text
);

revoke all on function public.finalize_daily_log(uuid) from public, anon, authenticated;
drop function if exists public.finalize_daily_log(uuid);
