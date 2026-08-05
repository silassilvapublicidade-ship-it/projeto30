import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/server/services/admin-library.service", () => ({ adminCreateLibraryContentAiDraft: vi.fn() }));
vi.mock("@/server/services/system-observability.service", () => ({ recordSystemError: vi.fn() }));
vi.mock("./ai-provider", () => ({ generateWithAiProvider: vi.fn(), isAiProviderConfigured: vi.fn() }));

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminCreateLibraryContentAiDraft } from "@/server/services/admin-library.service";
import { recordSystemError } from "@/server/services/system-observability.service";

import { generateWithAiProvider, isAiProviderConfigured } from "./ai-provider";
import { generateLibraryContentDraft } from "./library-content-generation.service";

const baseInput = { actorId: "admin-1", tone: "acolhedor" as const, topic: "Como recomeçar depois de perder a sequência" };

function mockRateLimit(hourlyCount: number, dailyCount: number) {
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => Promise.resolve({ count: hourlyCount })),
      })),
    })),
  }));
  // First call resolves hourly, second resolves daily - both use the same
  // chain shape, so we alternate the resolved count via call order.
  let call = 0;
  from.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => {
          call += 1;
          return Promise.resolve({ count: call === 1 ? hourlyCount : dailyCount });
        }),
      })),
    })),
  }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from } as never);
}

function validAiJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    bible_excerpt: null,
    bible_reference: null,
    body_sections: ["Primeiro parágrafo.", "Segundo parágrafo."],
    suggested_pillar: "character",
    tags: ["recomeço"],
    title: "Recomeçar com coragem",
    ...overrides,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockRateLimit(0, 0);
});

describe("generateLibraryContentDraft - provider not configured", () => {
  it("returns not_configured and never calls the provider or the rate-limit query", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(false);

    const result = await generateLibraryContentDraft(baseInput);

    expect(result).toEqual({
      message: expect.stringContaining("ANTHROPIC_API_KEY"),
      ok: false,
      reason: "not_configured",
    });
    expect(generateWithAiProvider).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe("generateLibraryContentDraft - rate limiting (Parte 20)", () => {
  it("blocks generation once the hourly limit is reached, without calling the provider", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(true);
    mockRateLimit(10, 10);

    const result = await generateLibraryContentDraft(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rate_limited");
    expect(generateWithAiProvider).not.toHaveBeenCalled();
  });
});

describe("generateLibraryContentDraft - provider failure", () => {
  it("returns provider_error and logs a sanitized failure to Observability", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(true);
    vi.mocked(generateWithAiProvider).mockResolvedValue({
      message: "timeout",
      ok: false,
      reason: "timeout",
    });

    const result = await generateLibraryContentDraft(baseInput);

    expect(result).toEqual({ message: "timeout", ok: false, reason: "provider_error" });
    expect(recordSystemError).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "library_ai_generation_provider" }),
    );
    expect(adminCreateLibraryContentAiDraft).not.toHaveBeenCalled();
  });
});

describe("generateLibraryContentDraft - invalid output (Parte 12/15)", () => {
  it("never saves a draft when the model's response isn't valid JSON matching the schema", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(true);
    vi.mocked(generateWithAiProvider).mockResolvedValue({
      model: "claude-sonnet-5",
      ok: true,
      text: "isto não é json nenhum",
    });

    const result = await generateLibraryContentDraft(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_output");
    expect(adminCreateLibraryContentAiDraft).not.toHaveBeenCalled();
    expect(recordSystemError).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "library_ai_generation_invalid_output" }),
    );
  });

  it("rejects output missing a required field (e.g. no suggested_pillar) even if the JSON itself parses", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(true);
    vi.mocked(generateWithAiProvider).mockResolvedValue({
      model: "claude-sonnet-5",
      ok: true,
      text: JSON.stringify({ body_sections: ["x"], title: "Sem pilar" }),
    });

    const result = await generateLibraryContentDraft(baseInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_output");
  });
});

describe("generateLibraryContentDraft - happy path", () => {
  it("saves a draft with bible fields always stripped, even if the model ignored the instruction and invented one", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(true);
    vi.mocked(generateWithAiProvider).mockResolvedValue({
      model: "claude-sonnet-5",
      ok: true,
      text: validAiJson({ bible_excerpt: "trecho inventado", bible_reference: "João 3:16" }),
    });
    vi.mocked(adminCreateLibraryContentAiDraft).mockResolvedValue("new-content-id");

    const result = await generateLibraryContentDraft(baseInput);

    expect(result).toEqual({ contentId: "new-content-id", ok: true });
    const [input] = vi.mocked(adminCreateLibraryContentAiDraft).mock.calls[0]!;
    expect(input.bibleExcerpt).toBeUndefined();
    expect(input.bibleReference).toBeUndefined();
    expect(input.body).toBe("Primeiro parágrafo.\n\nSegundo parágrafo.");
    expect(input.pillar).toBe("character");
  });

  it("flags requires_enhanced_review when the topic/title touches a sensitive keyword", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(true);
    vi.mocked(generateWithAiProvider).mockResolvedValue({
      model: "claude-sonnet-5",
      ok: true,
      text: validAiJson({ title: "Cuidando da sua saúde física" }),
    });
    vi.mocked(adminCreateLibraryContentAiDraft).mockResolvedValue("new-content-id");

    await generateLibraryContentDraft({ ...baseInput, topic: "dicas de treino e alimentação" });

    const [input] = vi.mocked(adminCreateLibraryContentAiDraft).mock.calls[0]!;
    expect(input.requiresEnhancedReview).toBe(true);
  });

  it("prefers the admin-provided pillar hint over the model's suggestion when one was given", async () => {
    vi.mocked(isAiProviderConfigured).mockReturnValue(true);
    vi.mocked(generateWithAiProvider).mockResolvedValue({
      model: "claude-sonnet-5",
      ok: true,
      text: validAiJson({ suggested_pillar: "body" }),
    });
    vi.mocked(adminCreateLibraryContentAiDraft).mockResolvedValue("new-content-id");

    await generateLibraryContentDraft({ ...baseInput, pillarHint: "spirit" });

    const [input] = vi.mocked(adminCreateLibraryContentAiDraft).mock.calls[0]!;
    expect(input.pillar).toBe("spirit");
  });
});
