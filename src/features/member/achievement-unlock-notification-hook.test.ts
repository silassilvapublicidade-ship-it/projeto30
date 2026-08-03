import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "features", "member", "journey.actions.ts"), "utf8");
}

describe("finalizeDayWithResponsesAction - achievement-unlocked notification hook", () => {
  const source = readSource();
  const fn = source.slice(
    source.indexOf("export async function finalizeDayWithResponsesAction"),
    source.length,
  );

  it("only reacts to unlockedAchievements already returned by finalize_daily_log_with_responses - never calls into the achievement engine's own RPC", () => {
    expect(fn).toContain("summary.unlockedAchievements.map((achievement) =>");
    expect(source).not.toContain("check_and_unlock");
    // the RPC is invoked exactly once inside the function - the hook only
    // reacts to that single response, never triggers a second finalize call
    const rpcCallMatches = fn.match(/rpc<RawFinalizeSummary>\("finalize_daily_log_with_responses"/g);
    expect(rpcCallMatches?.length).toBe(1);
  });

  it("never lets a notification failure break the finalize response the member sees", () => {
    expect(fn).toContain("try {");
    expect(fn).toContain("} catch (automationError) {");
    expect(fn).toContain("return { ok: true, summary };");
  });

  it("passes the real userAchievementId and the authenticated user's own id (never a client-supplied id)", () => {
    expect(fn).toContain("userAchievementId: achievement.userAchievementId");
    expect(fn).toContain("userId: user.id");
  });
});
