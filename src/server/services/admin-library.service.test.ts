import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { adminCreateLibraryContentAiDraft, adminTransitionLibraryContentStatus } from "./admin-library.service";

function mockServerClient(rpcImpl: (name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn(rpcImpl);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("adminTransitionLibraryContentStatus", () => {
  it("returns { ok: true } when the RPC succeeds", async () => {
    mockServerClient(async () => ({ data: null, error: null }));
    const result = await adminTransitionLibraryContentStatus({ id: "c1", status: "in_review" });
    expect(result).toEqual({ ok: true });
  });

  it("returns { ok: false, message } instead of throwing when the state machine blocks the transition (e.g. draft -> published)", async () => {
    mockServerClient(async () => ({
      data: null,
      error: { message: "So e possivel publicar ou agendar conteudo ja aprovado." },
    }));

    const result = await adminTransitionLibraryContentStatus({ id: "c1", status: "published" });

    expect(result).toEqual({ ok: false, message: "So e possivel publicar ou agendar conteudo ja aprovado." });
  });

  it("forwards scheduledAt only for the scheduled status call", async () => {
    const rpc = mockServerClient(async () => ({ data: null, error: null }));

    await adminTransitionLibraryContentStatus({ id: "c1", status: "scheduled", scheduledAt: "2026-09-01T10:00:00Z" });

    expect(rpc).toHaveBeenCalledWith("admin_transition_library_content_status", {
      p_id: "c1",
      p_status: "scheduled",
      p_scheduled_at: "2026-09-01T10:00:00Z",
    });
  });
});

describe("adminCreateLibraryContentAiDraft", () => {
  /**
   * Parte 16 do briefing: "nunca publicar trecho biblico inventado" - o
   * service NUNCA repassa bible_reference/bible_excerpt para a RPC, mesmo
   * que o chamador (por engano) os inclua no input. Este teste prova o
   * comportamento real da chamada RPC, não apenas que o código "parece"
   * bloquear isso.
   */
  it("always sends bible_reference/bible_excerpt as undefined, regardless of what a caller might pass", async () => {
    const rpc = mockServerClient(async () => ({ data: "new-content-id", error: null }));

    const id = await adminCreateLibraryContentAiDraft({
      aiGenerationMetadata: { model: "claude-sonnet-5", topic: "descanso" },
      pillar: "spirit",
      slug: "descanso-em-deus-abc123",
      title: "Descanso em Deus",
      // Mesmo se o chamador tentasse (não deveria, mas o service é a última linha de defesa):
      bibleExcerpt: "um trecho que a IA pode ter inventado",
      bibleReference: "Salmos 23:1",
    } as never);

    expect(id).toBe("new-content-id");
    const [, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(args.p_bible_reference).toBeUndefined();
    expect(args.p_bible_excerpt).toBeUndefined();
  });

  it("always marks source_type/author_type as ai_assisted and status as completed", async () => {
    const rpc = mockServerClient(async () => ({ data: "new-content-id", error: null }));

    await adminCreateLibraryContentAiDraft({
      aiGenerationMetadata: { model: "claude-sonnet-5" },
      pillar: "body",
      slug: "forca-no-corpo-xyz789",
      title: "Força no corpo",
    });

    expect(rpc).toHaveBeenCalledWith(
      "admin_create_library_content",
      expect.objectContaining({
        p_source_type: "ai_assisted",
        p_author_type: "ai_assisted",
        p_ai_generation_status: "completed",
      }),
    );
  });
});
