import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "services", "progress-share.service.ts"), "utf8");
}

describe("progress-share.service.ts - ownership and authorization (Parte D/25)", () => {
  const source = readSource();

  it("requires an authenticated session before touching data", () => {
    expect(source).toContain('const user = await requireAuthUser("/app/dashboard");');
  });

  it("the daily_log lookup IS the authorization check - filters by the joined enrollment's user_id, never trusts a client-supplied id alone", () => {
    expect(source).toContain('.eq("enrollment.user_id", user.id)');
    expect(source).toContain('.eq("status", "finalized")');
  });

  it("refuses to build a streak_record card for a day that isn't actually a real record", () => {
    expect(source).toContain('if (kind === "streak_record" && dailyLog.streak_at_finalize === null) {');
  });
});

describe("progress-share.service.ts - idempotency and cache (Parte D/27)", () => {
  const source = readSource();

  it("reuses an existing card when the payload hash is unchanged - never regenerates for nothing", () => {
    expect(source).toContain("if (existingCard?.payload_hash === payloadHash && existingCard.image_url) {");
  });

  it("looks up the existing card scoped to (daily_log_id, card_type, template_id) - matches the migration's unique index exactly", () => {
    const lookupStart = source.indexOf('.from("share_cards")\n    .select("id, image_url, payload_hash")');
    const lookupBlock = source.slice(lookupStart, lookupStart + 300);
    expect(lookupBlock).toContain('.eq("daily_log_id", dailyLog.id)');
    expect(lookupBlock).toContain('.eq("card_type", cardType)');
    expect(lookupBlock).toContain('.eq("template_id", templateRow.id)');
  });

  it("upserts on the same composite key as the migration's unique index - never duplicates a card for the same day+kind+template", () => {
    expect(source).toContain('{ onConflict: "daily_log_id,card_type,template_id" }');
  });

  it("card_type is derived from kind via a fixed lookup - progress for day_completed, streak_record for streak_record", () => {
    expect(source).toContain('day_completed: "progress"');
    expect(source).toContain('streak_record: "streak_record"');
  });
});

describe("progress-share.service.ts - no N+1 (Parte E/25)", () => {
  const source = readSource();

  it("resolves challenge day, completed habit ids and previous streak record in parallel, not sequentially per field", () => {
    expect(source).toContain("await Promise.all([");
  });

  it("looks up habit titles via a single batched query (id IN (...)), never one query per habit", () => {
    expect(source).toContain('.from("habits").select("title, sort_order").in("id", completedHabitIds)');
  });
});

describe("progress-share.service.ts - privacy", () => {
  const source = readSource();

  it("never selects or forwards the user's email/display name into the card content", () => {
    expect(source).not.toMatch(/display_name|\.email/);
  });
});
