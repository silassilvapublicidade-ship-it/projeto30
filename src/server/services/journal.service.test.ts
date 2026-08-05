import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { journalEntryHasContent, listJournalChallenges, listJournalEntries } from "./journal.service";

function mockServerClient(rpcImpl: (name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn(rpcImpl);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listJournalEntries", () => {
  it("defaults onlyWithContent to false, limit to 20, offset to 0", async () => {
    const rpc = mockServerClient(async () => ({ data: { rows: [], total: 0 }, error: null }));

    await listJournalEntries({});

    expect(rpc).toHaveBeenCalledWith("member_list_journal_entries", {
      p_challenge_id: undefined,
      p_period_days: undefined,
      p_only_with_content: false,
      p_search: undefined,
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("forwards every explicit filter unchanged", async () => {
    const rpc = mockServerClient(async () => ({ data: { rows: [], total: 0 }, error: null }));

    await listJournalEntries({
      challengeId: "challenge-1",
      periodDays: 30,
      onlyWithContent: true,
      search: "gratidão",
      limit: 10,
      offset: 20,
    });

    expect(rpc).toHaveBeenCalledWith("member_list_journal_entries", {
      p_challenge_id: "challenge-1",
      p_period_days: 30,
      p_only_with_content: true,
      p_search: "gratidão",
      p_limit: 10,
      p_offset: 20,
    });
  });

  it("throws on RPC error rather than returning a fake empty page", async () => {
    mockServerClient(async () => ({ data: null, error: { message: "rls denied" } }));
    await expect(listJournalEntries({})).rejects.toThrow("rls denied");
  });

  it("never leaks a null RPC response as anything but an empty page", async () => {
    mockServerClient(async () => ({ data: null, error: null }));
    const result = await listJournalEntries({});
    expect(result).toEqual({ rows: [], total: 0 });
  });
});

describe("listJournalChallenges", () => {
  it("returns [] when the RPC has no rows for this user (never journaled)", async () => {
    mockServerClient(async () => ({ data: null, error: null }));
    expect(await listJournalChallenges()).toEqual([]);
  });

  it("passes through the challenge options unchanged", async () => {
    mockServerClient(async () => ({
      data: [{ challenge_id: "c1", challenge_name: "Desafio de Agosto" }],
      error: null,
    }));
    expect(await listJournalChallenges()).toEqual([{ challenge_id: "c1", challenge_name: "Desafio de Agosto" }]);
  });
});

describe("journalEntryHasContent", () => {
  it("is false when every free-text field is empty, null, or whitespace-only", () => {
    expect(
      journalEntryHasContent({ content: null, gratitude: "  ", difficulty: null, victory: "", tomorrow_focus: null }),
    ).toBe(false);
  });

  it("is true when any single field has real content, matching admin_participant_detail's rule (0081)", () => {
    expect(
      journalEntryHasContent({ content: null, gratitude: null, difficulty: null, victory: "Terminei o treino", tomorrow_focus: null }),
    ).toBe(true);
  });
});
