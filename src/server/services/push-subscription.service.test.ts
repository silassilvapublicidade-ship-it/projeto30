import { describe, expect, it, vi } from "vitest";

import {
  getActivePushSubscriptionsForUsers,
  hasActivePushSubscription,
  recordPushFailure,
  recordPushSuccess,
} from "./push-subscription.service";

/**
 * getActivePushSubscriptionsForUsers/hasActivePushSubscription/
 * recordPushSuccess/recordPushFailure take the Supabase client as a
 * parameter (dependency injection) rather than constructing it internally -
 * that lets these tests build a real fake query builder and assert actual
 * runtime behavior (filters applied, rows mapped, updates issued), never
 * just grep the source text for a string.
 */
function makeFakeSupabase(overrides: {
  selectResult?: { data: unknown; error: unknown } | { count: number | null };
  updateSpy?: (table: string, payload: Record<string, unknown>) => void;
  eqSpy?: (column: string, value: unknown) => void;
}) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  function selectChain(table: string) {
    const chain: Record<string, unknown> = {
      in: vi.fn((column: string, values: unknown[]) => {
        calls.push({ table, method: "in", args: [column, values] });
        return chain;
      }),
      is: vi.fn((column: string, value: unknown) => {
        calls.push({ table, method: "is", args: [column, value] });
        return Promise.resolve(overrides.selectResult ?? { data: [], error: null });
      }),
      eq: vi.fn((column: string, value: unknown) => {
        overrides.eqSpy?.(column, value);
        calls.push({ table, method: "eq", args: [column, value] });
        return chain;
      }),
      maybeSingle: vi.fn(() => Promise.resolve(overrides.selectResult ?? { data: null, error: null })),
    };
    return chain;
  }

  const fake = {
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string, options?: { count?: string; head?: boolean }) => {
        calls.push({ table, method: "select", args: [columns, options] });
        return selectChain(table);
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        overrides.updateSpy?.(table, payload);
        calls.push({ table, method: "update", args: [payload] });
        return {
          eq: vi.fn((column: string, value: unknown) => {
            overrides.eqSpy?.(column, value);
            calls.push({ table, method: "eq", args: [column, value] });
            return Promise.resolve({ data: null, error: null });
          }),
        };
      }),
    })),
    __calls: calls,
  };

  return fake as never;
}

describe("getActivePushSubscriptionsForUsers", () => {
  it("returns [] without querying when userIds is empty", async () => {
    const supabase = makeFakeSupabase({});
    const result = await getActivePushSubscriptionsForUsers(supabase, []);
    expect(result).toEqual([]);
    expect((supabase as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it("maps snake_case rows to the camelCase ActivePushSubscription shape", async () => {
    const supabase = makeFakeSupabase({
      selectResult: {
        data: [
          { id: "sub-1", user_id: "user-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
          { id: "sub-2", user_id: "user-2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
        ],
        error: null,
      },
    });

    const result = await getActivePushSubscriptionsForUsers(supabase, ["user-1", "user-2"]);

    expect(result).toEqual([
      { id: "sub-1", userId: "user-1", endpoint: "https://push.example/1", p256dh: "p1", auth: "a1" },
      { id: "sub-2", userId: "user-2", endpoint: "https://push.example/2", p256dh: "p2", auth: "a2" },
    ]);
  });

  it("returns [] (never throws) when the query errors", async () => {
    const supabase = makeFakeSupabase({ selectResult: { data: null, error: { message: "boom" } } });
    const result = await getActivePushSubscriptionsForUsers(supabase, ["user-1"]);
    expect(result).toEqual([]);
  });
});

describe("hasActivePushSubscription", () => {
  it("returns true when count > 0", async () => {
    const supabase = makeFakeSupabase({ selectResult: { count: 2 } as never });
    expect(await hasActivePushSubscription(supabase, "user-1")).toBe(true);
  });

  it("returns false when count is 0 or null", async () => {
    const supabaseZero = makeFakeSupabase({ selectResult: { count: 0 } as never });
    expect(await hasActivePushSubscription(supabaseZero, "user-1")).toBe(false);

    const supabaseNull = makeFakeSupabase({ selectResult: { count: null } as never });
    expect(await hasActivePushSubscription(supabaseNull, "user-1")).toBe(false);
  });
});

describe("recordPushSuccess", () => {
  it("resets failure_count to 0 and stamps last_success_at", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const supabase = makeFakeSupabase({
      updateSpy: (_table, payload) => {
        capturedPayload = payload;
      },
    });

    await recordPushSuccess(supabase, "sub-1");

    expect(capturedPayload).toMatchObject({ failure_count: 0 });
    expect(typeof (capturedPayload as unknown as { last_success_at: string }).last_success_at).toBe("string");
  });
});

describe("recordPushFailure", () => {
  it("permanent failure soft-revokes the subscription (sets revoked_at, never increments failure_count)", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const supabase = makeFakeSupabase({
      updateSpy: (_table, payload) => {
        capturedPayload = payload;
      },
    });

    await recordPushFailure(supabase, "sub-1", { permanent: true });

    expect(capturedPayload).toHaveProperty("revoked_at");
    expect(capturedPayload).not.toHaveProperty("failure_count");
  });

  it("temporary failure increments failure_count from the existing value", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const supabase = makeFakeSupabase({
      selectResult: { data: { failure_count: 3 }, error: null },
      updateSpy: (_table, payload) => {
        capturedPayload = payload;
      },
    });

    await recordPushFailure(supabase, "sub-1", { permanent: false });

    expect(capturedPayload).toMatchObject({ failure_count: 4 });
    expect(capturedPayload).not.toHaveProperty("revoked_at");
  });

  it("temporary failure defaults to failure_count 1 when no prior row is found", async () => {
    let capturedPayload: Record<string, unknown> | null = null;
    const supabase = makeFakeSupabase({
      selectResult: { data: null, error: null },
      updateSpy: (_table, payload) => {
        capturedPayload = payload;
      },
    });

    await recordPushFailure(supabase, "sub-1", { permanent: false });

    expect(capturedPayload).toMatchObject({ failure_count: 1 });
  });
});
