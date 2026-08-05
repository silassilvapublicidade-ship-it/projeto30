import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { getLibraryContentBySlug, listLibraryContents, upsertLibraryProgress } from "./library.service";

function mockServerClient(rpcImpl: (name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn(rpcImpl);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listLibraryContents", () => {
  it("defaults limit/offset and forwards pillar/category/challenge/search filters", async () => {
    const rpc = mockServerClient(async () => ({ data: { rows: [{ id: "c1" }], total: 1 }, error: null }));

    const result = await listLibraryContents({ pillar: "mind", search: "oração" });

    expect(result).toEqual({ rows: [{ id: "c1" }], total: 1 });
    expect(rpc).toHaveBeenCalledWith("member_list_library_contents", {
      p_pillar: "mind",
      p_category: undefined,
      p_challenge_id: undefined,
      p_search: "oração",
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("returns empty rows/total 0 when the RPC returns null", async () => {
    mockServerClient(async () => ({ data: null, error: null }));
    const result = await listLibraryContents({});
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it("throws on RPC error", async () => {
    mockServerClient(async () => ({ data: null, error: { message: "rls denied" } }));
    await expect(listLibraryContents({})).rejects.toThrow("rls denied");
  });
});

describe("getLibraryContentBySlug", () => {
  it("returns null (not an error) when the RPC resolves with no content, e.g. a draft slug", async () => {
    mockServerClient(async () => ({ data: null, error: null }));
    const result = await getLibraryContentBySlug("rascunho-nao-publicado");
    expect(result).toBeNull();
  });

  it("passes the slug through and returns the detail as-is", async () => {
    const detail = { id: "c1", slug: "descanso-em-deus", title: "Descanso em Deus" };
    const rpc = mockServerClient(async () => ({ data: detail, error: null }));

    const result = await getLibraryContentBySlug("descanso-em-deus");

    expect(result).toEqual(detail);
    expect(rpc).toHaveBeenCalledWith("member_get_library_content", { p_slug: "descanso-em-deus" });
  });
});

describe("upsertLibraryProgress", () => {
  it("forwards contentId/status/progressPercent with the p_ prefix", async () => {
    const rpc = mockServerClient(async () => ({ data: null, error: null }));

    await upsertLibraryProgress({ contentId: "c1", status: "reading", progressPercent: 50 });

    expect(rpc).toHaveBeenCalledWith("member_upsert_library_progress", {
      p_content_id: "c1",
      p_status: "reading",
      p_progress_percent: 50,
    });
  });

  it("throws on RPC error rather than silently no-op-ing", async () => {
    mockServerClient(async () => ({ data: null, error: { message: "not found" } }));
    await expect(upsertLibraryProgress({ contentId: "c1", status: "completed" })).rejects.toThrow("not found");
  });
});
