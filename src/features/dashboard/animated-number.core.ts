/**
 * Regra pura de "quando vale a pena animar um numero" (Refinamento premium,
 * Parte B item 4) - nunca conta do zero a cada navegacao, nunca repete a
 * animacao quando o usuario so voltou para a mesma tela sem nada mudar.
 * Anima apenas: primeira entrada da sessao (previousValue null - o cliente
 * ainda nao viu esse numero) ou mudanca real de valor (finalizacao, nova
 * conquista, etc). O valor exibido em si SEMPRE e o real - esta funcao so
 * decide se a transicao ate ele e animada ou instantanea.
 */
export function shouldAnimateNumberChange(input: { previousValue: number | null; value: number }): boolean {
  if (input.previousValue === null) return true;
  return input.previousValue !== input.value;
}
