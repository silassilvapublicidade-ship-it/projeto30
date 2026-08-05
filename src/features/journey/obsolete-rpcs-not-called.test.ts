import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Parte 23/G - update_habit_log e finalize_daily_log (RPCs revogadas e
 * dropadas em 0089_drop_obsolete_journey_rpcs.sql, superadas por
 * finalize_daily_log_with_responses desde 0037) não existem mais no banco
 * de produção. Este teste não confirma comportamento de runtime (isso já
 * foi validado em transação com rollback contra o banco linkado antes de
 * aplicar 0089) - é um guardrail para o futuro: se algum código voltar a
 * chamar supabase.rpc("update_habit_log", ...) ou
 * supabase.rpc("finalize_daily_log", ...), a chamada real falharia em
 * produção (função inexistente) sem nenhum erro de compilação a avisar
 * (RPCs são strings, TypeScript não pega isso sozinho). Roda sobre TODO
 * src/, não um arquivo fixo, para pegar qualquer novo call site futuro.
 */
function listTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      listTsFiles(fullPath, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
      out.push(fullPath);
    }
  }
  return out;
}

describe("obsolete journey RPCs are never called from application code", () => {
  const files = listTsFiles(join(process.cwd(), "src"));
  const rpcCallPattern = /\.rpc\(\s*["'`](update_habit_log|finalize_daily_log)["'`]/;

  it("no file calls supabase.rpc(\"update_habit_log\" | \"finalize_daily_log\", ...) - both were dropped in migration 0089, superseded by finalize_daily_log_with_responses", () => {
    const offenders = files.filter((file) => rpcCallPattern.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
