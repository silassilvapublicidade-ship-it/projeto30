import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "server", "services", "notification-automations.service.ts"),
    "utf8",
  );
}

describe("notification-automations.service.ts - safety contract", () => {
  const source = readSource();

  it("creates the campaign row via upsert on idempotency_key with ignoreDuplicates - never a second insert for the same trigger", () => {
    expect(source).toContain('{ ignoreDuplicates: true, onConflict: "idempotency_key" }');
  });

  it("every automation's idempotency key is namespaced by its own automation type", () => {
    expect(source).toContain("`daily_reminder:${localDate}`");
    expect(source).toContain("`${input.automationType}:${challengeId}:${referenceDate}`");
    expect(source).toContain("`user_inactive_3_days:${todayReferenceDate()}`");
    expect(source).toContain("`new_tip_published:${input.tipId}:${input.publishedAt}`");
    expect(source).toContain("`achievement_unlocked:${input.userAchievementId}`");
  });

  it("achievement automation is keyed by the user_achievement id itself, so a retried unlock event can never duplicate the notification", () => {
    const fn = source.slice(source.indexOf("export async function runAchievementUnlockedAutomation"));
    expect(fn).toContain("idempotencyKey: `achievement_unlocked:${input.userAchievementId}`");
  });

  it("new-tip automation is keyed by (tip, publish timestamp), allowing a genuine re-publish to notify again while a retried request of the same publish stays idempotent", () => {
    const fn = source.slice(
      source.indexOf("export async function runNewTipPublishedAutomation"),
      source.indexOf("export async function runAchievementUnlockedAutomation"),
    );
    expect(fn).toContain("idempotencyKey: `new_tip_published:${input.tipId}:${input.publishedAt}`");
  });

  it("groups the daily reminder by distinct local date rather than creating one campaign per user", () => {
    const fn = source.slice(
      source.indexOf("export async function runDailyReminderAutomation"),
      source.indexOf("async function runChallengeDateAutomation"),
    );
    expect(fn).toContain("byLocalDate");
    expect(fn).not.toMatch(/idempotencyKey: `daily_reminder:\$\{row\.user_id\}/);
  });

  it("groups challenge date automations by challenge, one campaign per challenge rather than per user", () => {
    const fn = source.slice(
      source.indexOf("async function runChallengeDateAutomation"),
      source.indexOf("export async function runChallengeStartingTomorrowAutomation"),
    );
    expect(fn).toContain("byChallenge");
  });

  it("every automation campaign row created here uses source='automation', never 'admin'", () => {
    expect(source).toContain('source: "automation"');
  });

  it("runAllScheduledAutomations covers exactly the 5 date-driven automations - new tip and achievement are event-driven, triggered from their own call sites, not polled here", () => {
    const fn = source.slice(source.indexOf("export async function runAllScheduledAutomations"));
    expect(fn).toContain("runDailyReminderAutomation();");
    expect(fn).toContain("runChallengeStartingTomorrowAutomation();");
    expect(fn).toContain("runChallengeStartingTodayAutomation();");
    expect(fn).toContain("runChallengeEndingSoonAutomation();");
    expect(fn).toContain("runInactiveUserAutomation();");
    expect(fn).not.toContain("runNewTipPublishedAutomation");
    expect(fn).not.toContain("runAchievementUnlockedAutomation");
  });

  it("never imports or calls anything from the achievement engine's own migration-level RPCs - only reacts to what finalize_daily_log_with_responses already returned", () => {
    expect(source).not.toContain("finalize_daily_log_with_responses");
    expect(source).not.toContain("check_and_unlock");
  });
});
