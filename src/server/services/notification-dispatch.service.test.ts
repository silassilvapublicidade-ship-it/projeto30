import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// No Supabase client in this test environment (see repo-wide convention: no
// mocking layer for the Supabase client anywhere in this codebase) - these
// are source-level regression tests locking in the safety contract of the
// batch dispatch/retry engine. Real delivery is exercised in production
// validation against a real push subscription and a real 410 response.
function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "server", "services", "notification-dispatch.service.ts"),
    "utf8",
  );
}

describe("notification-dispatch.service.ts - safety contract", () => {
  const source = readSource();

  it("keys delivery idempotency on (campaign, user), never re-inserting the internal notification or re-sending push for an already-resolved delivery", () => {
    expect(source).toContain("`${campaignId}:${userId}`");
    expect(source).toContain('ignoreDuplicates: true, onConflict: "campaign_id,user_id"');
    expect(source).toContain('["cancelled", "clicked", "delivered", "failed", "opened", "read", "sent"].includes(delivery.status)');
  });

  it("revokes a push subscription immediately and never retries on a permanent (404/410) failure", () => {
    expect(source).toContain('result.permanent');
    expect(source).toContain("revoked_at: new Date().toISOString()");
    const attemptPushFn = source.slice(source.indexOf("async function attemptPush"), source.indexOf("async function resolveDeliveryOutcome"));
    expect(attemptPushFn).not.toContain("retry_count");
  });

  it("caps push retries and stops scheduling next_retry_at once the limit is reached", () => {
    expect(source).toContain("const MAX_PUSH_RETRIES = 5;");
    expect(source).toContain("if (nextRetryCount >= MAX_PUSH_RETRIES) {");
    expect(source).toContain("next_retry_at: null,");
  });

  it("treats a delivery as successful when the internal channel delivered even if push has no eligible subscription - internal-only is never a failure", () => {
    expect(source).toContain("const status = campaign.channel_internal ? \"sent\" : \"failed\";");
  });

  it("dispatches in bounded batches, never one unbounded Promise.all over the whole audience", () => {
    expect(source).toContain("const DISPATCH_BATCH_SIZE = 200;");
    expect(source).toContain("index += DISPATCH_BATCH_SIZE");
  });

  it("admin-sourced campaigns are only ever dispatched once (gated on status==='processing'), while automation campaigns can be re-dispatched to catch stragglers", () => {
    expect(source).toContain('campaign.source === "admin" && campaign.status !== "processing"');
  });

  it("never logs or returns the push subscription's endpoint, p256dh or auth", () => {
    expect(source).not.toMatch(/console\.(log|error|warn)\([^)]*endpoint/i);
    expect(source).not.toMatch(/console\.(log|error|warn)\([^)]*p256dh/i);
    expect(source).not.toMatch(/console\.(log|error|warn)\([^)]*\bauth\b/i);
  });

  it("processNotificationCampaign resolves the audience through resolve_notification_audience_combined (Modulo G, Parte 11) - the same combined wrapper admin_estimate_notification_audience uses, so min_streak_threshold/habit_keyword can never diverge between the shown estimate and the real send", () => {
    expect(source).toContain('supabase.rpc("resolve_notification_audience_combined"');
    expect(source).toContain("p_combined_min_streak: campaign.min_streak_threshold ?? undefined");
  });

  it("finalizes a campaign as sent/partially_failed/failed only once no deliveries remain pending", () => {
    const finalizeFn = source.slice(
      source.indexOf("async function finalizeCampaignIfDone"),
      source.indexOf("/**", source.indexOf("async function finalizeCampaignIfDone") + 10),
    );
    expect(finalizeFn).toContain('row.status === "pending"');
    expect(finalizeFn).toContain("return; // retries still outstanding");
  });

  it("retryDueNotificationDeliveries only picks up push failures whose next_retry_at has arrived", () => {
    const retryFn = source.slice(source.indexOf("export async function retryDueNotificationDeliveries"));
    expect(retryFn).toContain('.eq("status", "pending")');
    expect(retryFn).toContain('.lte("next_retry_at", new Date().toISOString())');
  });

  it("processDueScheduledCampaigns atomically claims a scheduled campaign (conditional update) before dispatching it, preventing double-processing", () => {
    const fn = source.slice(source.indexOf("export async function processDueScheduledCampaigns"));
    expect(fn).toContain('.eq("id", id)\n      .eq("status", "scheduled");');
  });
});
