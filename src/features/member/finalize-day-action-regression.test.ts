import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "features", "member", "journey.actions.ts"), "utf8");
}

describe("finalizeDayWithResponsesAction", () => {
  const source = readSource();
  const start = source.indexOf("export async function finalizeDayWithResponsesAction");
  const body = source.slice(start);

  it("requires an authenticated session before touching anything", () => {
    expect(body).toContain('await requireAuthUser("/app/hoje")');
  });

  it("validates dailyLogId and every response item through a zod schema before calling the RPC", () => {
    expect(source).toContain("finalizeWithResponsesSchema.safeParse({ dailyLogId, responses })");
    expect(source).toContain("finalizeResponseItemSchema");
    expect(source).toContain('status: z.enum(["completed", "not_applicable", "pending"])');
  });

  it("caps the responses array the same way the RPC itself does (defense in depth, not the only guard)", () => {
    expect(source).toContain("z.array(finalizeResponseItemSchema).max(200)");
  });

  it("calls the single batched RPC, never update_habit_log per item", () => {
    expect(body).toContain('rpc<RawFinalizeSummary>("finalize_daily_log_with_responses"');
    expect(body).not.toContain('"update_habit_log"');
  });

  it("never loops over responses to make multiple RPC calls - exactly one rpc() call in the whole function", () => {
    const rpcCalls = body.split('rpc.rpc<RawFinalizeSummary>("finalize_daily_log_with_responses"').length - 1;
    expect(rpcCalls).toBe(1);
  });

  it("always returns the same reassuring message on failure, regardless of the underlying Postgres error", () => {
    expect(body).toContain(
      "Não foi possível finalizar o dia. Suas respostas foram mantidas. Tente novamente.",
    );
  });

  it("logs the raw RPC failure server-side before returning the safe message", () => {
    expect(body).toContain('logJourneyRpcFailure(\n      "finalize_daily_log_with_responses",');
  });

  it("revalidates Hoje, Jornada and Conquistas only on success, not on every local edit (there is no per-edit call to revalidate)", () => {
    const successBlock = body.split("if (error || !data) {")[1]?.split("return { ok: true")[0];
    expect(successBlock).toBeDefined();
    expect(successBlock).toContain('revalidatePath("/app/hoje")');
    expect(successBlock).toContain('revalidatePath("/app/jornada")');
    expect(successBlock).toContain('revalidatePath("/app/conquistas")');
  });

  it("is not bound to a <form action> - it's a plain async function the client calls directly, so it can return the rich summary", () => {
    expect(body).toMatch(
      /export async function finalizeDayWithResponsesAction\(\s*dailyLogId: string,\s*responses: FinalizeResponseInput\[\],\s*\): Promise<FinalizeDayActionResult>/,
    );
  });
});

describe("journey.actions.ts - dead per-click actions removed", () => {
  const source = readSource();

  it("no longer exports updateHabitLogAction or the old checkbox-only finalizeDailyLogAction", () => {
    expect(source).not.toContain("export async function updateHabitLogAction");
    expect(source).not.toContain("export async function finalizeDailyLogAction");
  });

  it("saveJournalEntryAction is untouched - the diary keeps its own separate save flow, not merged into the batch", () => {
    expect(source).toContain("export async function saveJournalEntryAction");
    expect(source).toContain('rpc.rpc("save_journal_entry"');
  });
});
