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

  it("runAllScheduledAutomations covers the 5 date-driven automations plus the smart tick (habit reminders + daily motivation) and the generic launch campaign - new tip and achievement stay event-driven, triggered from their own call sites, not polled here", () => {
    const fn = source.slice(source.indexOf("export async function runAllScheduledAutomations"));
    expect(fn).toContain("runDailyReminderAutomation();");
    expect(fn).toContain("runChallengeStartingTomorrowAutomation();");
    expect(fn).toContain("runChallengeStartingTodayAutomation();");
    expect(fn).toContain("runChallengeEndingSoonAutomation();");
    expect(fn).toContain("runChallengeLaunchCampaignAutomation();");
    expect(fn).toContain("runInactiveUserAutomation();");
    expect(fn).toContain("runSmartNotificationTick();");
    expect(fn).not.toContain("runNewTipPublishedAutomation");
    expect(fn).not.toContain("runAchievementUnlockedAutomation");
  });
});

describe("notification-automations.service.ts - runChallengeLaunchCampaignAutomation (generic launch campaign)", () => {
  const source = readSource();
  const fn = source.slice(
    source.indexOf("export async function runChallengeLaunchCampaignAutomation"),
    source.indexOf("export async function sendChallengeLaunchStepTestNotification"),
  );

  it("only ever looks at published (active), non-deleted challenges - draft/paused/unpublished challenges are excluded by the query itself, never by an explicit cancel step", () => {
    expect(fn).toContain('.eq("status", "active")');
    expect(fn).toContain('.is("deleted_at", null)');
  });

  it("only considers steps the admin explicitly enabled, never all 5 by default", () => {
    expect(fn).toContain('.eq("enabled", true)');
  });

  it("recomputes the target date from start_date + days_offset on every tick instead of reading a persisted target date, so a start_date edit reprograms the step automatically", () => {
    expect(fn).toContain("computeLaunchCampaignStepTargetDate(challenge.start_date, step.days_offset)");
    expect(fn).toContain("targetDate !== today");
  });

  it("idempotency key includes the recomputed target date, so a rescheduled step (new date) is never blocked by an old campaign row, and a same-day retry never double-sends", () => {
    expect(fn).toContain(
      "idempotencyKey: `challenge_launch:${challenge.id}:${step.step_key}:${targetDate}`",
    );
  });

  it("resolves the audience via the dedicated not-yet-enrolled resolver, never the enrolled-only challenge_date resolver", () => {
    expect(fn).toContain('"automation_resolve_challenge_launch_audience"');
    expect(fn).not.toContain("automation_resolve_challenge_date_audience");
  });

  it("skips dispatch entirely when the resolved audience is empty, rather than creating an empty campaign", () => {
    expect(fn).toContain("!audience || audience.length === 0");
  });
});

describe("notification-automations.service.ts - sendChallengeLaunchStepTestNotification (QA test-send)", () => {
  const source = readSource();
  const fn = source.slice(
    source.indexOf("export async function sendChallengeLaunchStepTestNotification"),
    source.indexOf("export async function runInactiveUserAutomation"),
  );

  it("reads the persisted step content (title/message), never a separately-passed ad-hoc string, so the test always reflects what's actually saved", () => {
    expect(fn).toContain('.eq("challenge_id", input.challengeId)');
    expect(fn).toContain('.eq("step_key", input.stepKey)');
    expect(fn).toContain("message: step.message");
    expect(fn).toContain("title: step.title");
  });

  it("idempotency key includes Date.now() so a test send always goes out again, never blocked by a previous test's idempotency", () => {
    expect(fn).toMatch(/idempotencyKey: `challenge_launch_test:.*\$\{Date\.now\(\)\}`/);
  });

  it("dispatches through the same real engine (getOrCreateAutomationCampaign + dispatchCampaignToAudience) to exactly one user, never a simulated/mocked send", () => {
    expect(fn).toContain("getOrCreateAutomationCampaign(supabase, {");
    expect(fn).toContain("dispatchCampaignToAudience(campaignId, [{ push_eligible: pushEligible, user_id: input.testUserId }])");
  });
});

describe("notification-automations.service.ts - Modulo G smart tick (runSmartNotificationTick)", () => {
  const source = readSource();
  const fn = source.slice(
    source.indexOf("export async function runSmartNotificationTick"),
    source.indexOf("/** Runs every date-driven automation once"),
  );

  it("calls the single RPC engine, never resolving audience or anti-spam logic itself in TS (Parte 14: selecao roda no banco)", () => {
    expect(fn).toContain('supabase.rpc("automation_resolve_smart_notification_candidates"');
  });

  it("groups results by candidate_key so each habit and the daily motivation message each get their own campaign, not one campaign per user", () => {
    expect(fn).toContain("byCandidateKey");
    expect(fn).toContain("row.candidate_key");
  });

  it("habit reminder campaigns are keyed per habit per day (re-dispatchable across ticks, distinct per habit) - the daily motivation campaign is keyed once per day for the whole app", () => {
    expect(fn).toContain("`habit_reminder:${sample.habit_id}:${today}`");
    expect(fn).toContain("`daily_motivation:${today}`");
  });

  it("uses automation_type values that exactly match what the SQL anti-spam window checks (n.type in ('habit_reminder', 'daily_motivation'))", () => {
    expect(fn).toContain('automationType: isMotivation ? "daily_motivation" : "habit_reminder"');
  });

  it("picks today's motivation message via pickDailyMotivationMessage before calling the RPC, never inline/random in the dispatch loop itself", () => {
    expect(fn).toContain("pickDailyMotivationMessage(supabase)");
  });
});

describe("notification-automations.service.ts - Modulo G pickDailyMotivationMessage (Parte 3: never repeat consecutive days)", () => {
  const source = readSource();
  const fn = source.slice(
    source.indexOf("async function pickDailyMotivationMessage"),
    source.indexOf("export async function runSmartNotificationTick"),
  );

  it("looks up the most recent daily_motivation campaign to decide whether today's message was already chosen", () => {
    expect(fn).toContain('.eq("automation_type", "daily_motivation")');
    expect(fn).toContain('.order("created_at", { ascending: false })');
  });

  it("reuses the same message across ticks within the same day (stability), and only re-draws once the last pick is from a prior day", () => {
    expect(fn).toContain("toSaoPauloDate(lastCampaign.created_at) === today");
  });

  it("excludes the most recent message from the new draw whenever there's more than one eligible message, satisfying the never-repeat-consecutive-day rule", () => {
    expect(fn).toContain("message.id !== lastMessageId");
  });

  it("filters candidates by their starts_at/ends_at window before drawing, respecting daily_motivation_messages' own eligibility window", () => {
    expect(fn).toContain("message.starts_at");
    expect(fn).toContain("message.ends_at");
  });

  it("never imports or calls anything from the achievement engine's own migration-level RPCs - only reacts to what finalize_daily_log_with_responses already returned", () => {
    expect(source).not.toContain("finalize_daily_log_with_responses");
    expect(source).not.toContain("check_and_unlock");
  });
});
