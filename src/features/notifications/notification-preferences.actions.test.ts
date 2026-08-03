import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(
    join(process.cwd(), "src", "features", "notifications", "notification-preferences.actions.ts"),
    "utf8",
  );
}

describe("notification-preferences.actions.ts - Modulo G, Parte 9", () => {
  const source = readSource();

  it("parses all 4 new toggles from FormData", () => {
    expect(source).toContain('adminCampaignNotifications: formData.get("adminCampaignNotifications") === "on"');
    expect(source).toContain('dailyMotivationEnabled: formData.get("dailyMotivationEnabled") === "on"');
    expect(source).toContain('faithMessagesEnabled: formData.get("faithMessagesEnabled") === "on"');
    expect(source).toContain('habitRemindersEnabled: formData.get("habitRemindersEnabled") === "on"');
  });

  it("writes all 4 new toggles into the persisted notifications jsonb, under their DB key names", () => {
    expect(source).toContain("admin_campaign_notifications: parsed.data.adminCampaignNotifications");
    expect(source).toContain("daily_motivation_enabled: parsed.data.dailyMotivationEnabled");
    expect(source).toContain("faith_messages_enabled: parsed.data.faithMessagesEnabled");
    expect(source).toContain("habit_reminders_enabled: parsed.data.habitRemindersEnabled");
  });

  it("still merges over the existing jsonb (...asRecord(existing?.notifications)) rather than replacing it - never drops email/in_app/communication_opt_in", () => {
    expect(source).toContain("...asRecord(existing?.notifications),");
  });
});
