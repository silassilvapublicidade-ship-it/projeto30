import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("./notification-dispatch.service", () => ({ dispatchCampaignToAudience: vi.fn() }));
vi.mock("./rpc-logging.service", () => ({ logRpcFailure: vi.fn() }));

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { dispatchCampaignToAudience } from "./notification-dispatch.service";
import { runFeedbackRespondedAutomation } from "./notification-automations.service";

type UpsertCall = { idempotency_key: string; title: string; message: string; destination_type: string };

function makeAdminMock(options: { audienceRows: Array<{ push_eligible: boolean; user_id: string }> }) {
  const upsertCalls: UpsertCall[] = [];
  const rpc = vi.fn(() => Promise.resolve({ data: options.audienceRows, error: null }));

  const admin = {
    rpc,
    from: vi.fn((table: string) => {
      if (table !== "notification_campaigns") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        upsert: vi.fn((payload: UpsertCall) => {
          upsertCalls.push(payload);
          return Promise.resolve({ data: null, error: null });
        }),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { id: "campaign-1" }, error: null })),
          })),
        })),
      };
    }),
  };

  return { admin, upsertCalls, rpc };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("runFeedbackRespondedAutomation - Parte E (fecha o ciclo do Feedback)", () => {
  it("resolves the audience for exactly the feedback's own author, never a broader audience", async () => {
    const { admin, rpc } = makeAdminMock({ audienceRows: [{ push_eligible: true, user_id: "user-1" }] });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    await runFeedbackRespondedAutomation({ event: "responded", feedbackId: "feedback-1", userId: "user-1" });

    expect(rpc).toHaveBeenCalledWith("automation_resolve_important_update_audience", { p_user_ids: ["user-1"] });
  });

  it("uses the exact required copy for a response, and never leaks the response text itself (never passed to this function at all)", async () => {
    const { admin, upsertCalls } = makeAdminMock({ audienceRows: [{ push_eligible: true, user_id: "user-1" }] });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    await runFeedbackRespondedAutomation({ event: "responded", feedbackId: "feedback-1", userId: "user-1" });

    expect(upsertCalls[0]).toMatchObject({
      destination_type: "feedback",
      title: "Seu feedback recebeu uma resposta",
      message: "Abra o Projeto 30 para acompanhar a resposta.",
    });
  });

  it("keys idempotency by (event, feedbackId) so re-triggering the same event never double-notifies", async () => {
    const { admin, upsertCalls } = makeAdminMock({ audienceRows: [{ push_eligible: true, user_id: "user-1" }] });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    await runFeedbackRespondedAutomation({ event: "status_resolved", feedbackId: "feedback-1", userId: "user-1" });

    expect(upsertCalls[0]!.idempotency_key).toBe("feedback_status_resolved:feedback-1");
  });

  it("dispatches to the resolved audience through the shared campaign engine (never a parallel send path)", async () => {
    const audienceRows = [{ push_eligible: true, user_id: "user-1" }];
    const { admin } = makeAdminMock({ audienceRows });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    await runFeedbackRespondedAutomation({ event: "status_planned", feedbackId: "feedback-1", userId: "user-1" });

    expect(dispatchCampaignToAudience).toHaveBeenCalledWith("campaign-1", audienceRows);
  });

  it("never dispatches anything when the user has no push/in-app eligibility rows (e.g. deleted account)", async () => {
    const { admin } = makeAdminMock({ audienceRows: [] });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);

    await runFeedbackRespondedAutomation({ event: "responded", feedbackId: "feedback-1", userId: "user-1" });

    expect(dispatchCampaignToAudience).not.toHaveBeenCalled();
  });

  it("uses distinct, non-generic copy for status_planned and status_resolved (never the same message reused)", async () => {
    const { admin: adminPlanned, upsertCalls: plannedCalls } = makeAdminMock({
      audienceRows: [{ push_eligible: true, user_id: "user-1" }],
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminPlanned as never);
    await runFeedbackRespondedAutomation({ event: "status_planned", feedbackId: "feedback-1", userId: "user-1" });

    const { admin: adminResolved, upsertCalls: resolvedCalls } = makeAdminMock({
      audienceRows: [{ push_eligible: true, user_id: "user-1" }],
    });
    vi.mocked(createSupabaseAdminClient).mockReturnValue(adminResolved as never);
    await runFeedbackRespondedAutomation({ event: "status_resolved", feedbackId: "feedback-1", userId: "user-1" });

    expect(plannedCalls[0]!.title).not.toBe(resolvedCalls[0]!.title);
    expect(plannedCalls[0]!.message).not.toBe(resolvedCalls[0]!.message);
  });
});
