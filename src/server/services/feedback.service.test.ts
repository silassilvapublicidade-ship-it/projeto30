import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { adminDeleteFeedback, adminUpdateFeedback, createFeedback } from "./feedback.service";

function mockServerClient(rpcImpl: (name: string, args?: unknown) => Promise<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn(rpcImpl);
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return rpc;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createFeedback", () => {
  it("forwards every field to create_user_feedback with the p_ prefix and returns id/protocolCode", async () => {
    const rpc = mockServerClient(async () => ({
      data: { id: "feedback-1", protocolCode: "P30-0001" },
      error: null,
    }));

    const result = await createFeedback({
      id: "feedback-1",
      feedbackType: "problem",
      category: "bug",
      title: "Botão não funciona",
      description: "Ao clicar nada acontece",
      sentiment: null,
      allowContact: true,
      includeTechnical: true,
      route: "/app/hoje",
      diagnosticCode: "ERR-123",
      appVersion: "1.2.3",
      browser: "Chrome",
      operatingSystem: "Android",
      isPwa: true,
      viewport: "390x844",
      attachmentStoragePath: null,
    });

    expect(result).toEqual({ id: "feedback-1", protocolCode: "P30-0001" });
    expect(rpc).toHaveBeenCalledWith(
      "create_user_feedback",
      expect.objectContaining({
        p_id: "feedback-1",
        p_feedback_type: "problem",
        p_title: "Botão não funciona",
        p_allow_contact: true,
        p_diagnostic_code: "ERR-123",
      }),
    );
  });

  it("throws with the Postgres error message when the RPC fails, never swallowing the failure", async () => {
    mockServerClient(async () => ({ data: null, error: { message: "duplicate protocol" } }));

    await expect(
      createFeedback({
        id: "feedback-1",
        feedbackType: "problem",
        category: null,
        title: "x",
        description: "y",
        sentiment: null,
        allowContact: false,
        includeTechnical: false,
        route: null,
        diagnosticCode: null,
        appVersion: null,
        browser: null,
        operatingSystem: null,
        isPwa: false,
        viewport: null,
        attachmentStoragePath: null,
      }),
    ).rejects.toThrow("duplicate protocol");
  });
});

describe("adminUpdateFeedback", () => {
  it("passes status/priority/adminResponse through, and coerces empty optional fields to undefined", async () => {
    const rpc = mockServerClient(async () => ({ data: true, error: null }));

    const result = await adminUpdateFeedback({
      id: "feedback-1",
      status: "planned",
      priority: "high",
      adminResponse: "Já identificamos o problema.",
      internalNotes: "",
      resolvedInVersion: undefined,
      diagnosticCode: undefined,
    });

    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith("admin_update_user_feedback", {
      p_id: "feedback-1",
      p_status: "planned",
      p_priority: "high",
      p_admin_response: "Já identificamos o problema.",
      p_internal_notes: undefined,
      p_resolved_in_version: undefined,
      p_diagnostic_code: undefined,
    });
  });

  it("throws when the underlying RPC errors", async () => {
    mockServerClient(async () => ({ data: null, error: { message: "not allowed" } }));

    await expect(adminUpdateFeedback({ id: "feedback-1", status: "resolved" })).rejects.toThrow("not allowed");
  });
});

describe("adminDeleteFeedback", () => {
  it("removes the attachment from Storage only when the RPC returns a storage path", async () => {
    mockServerClient(async () => ({ data: "user-feedback-attachments/feedback-1/photo.png", error: null }));
    const removeSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      storage: { from: vi.fn(() => ({ remove: removeSpy })) },
    } as never);

    await adminDeleteFeedback("feedback-1");

    expect(removeSpy).toHaveBeenCalledWith(["user-feedback-attachments/feedback-1/photo.png"]);
  });

  it("never touches Storage when the feedback had no attachment", async () => {
    mockServerClient(async () => ({ data: null, error: null }));
    const adminClient = { storage: { from: vi.fn() } };
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminClient as never);

    await adminDeleteFeedback("feedback-1");

    expect(adminClient.storage.from).not.toHaveBeenCalled();
  });
});
