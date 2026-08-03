import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_PREFERENCES_DEFAULTS,
  notificationPreferencesFormSchema,
  REMINDER_TIME_MAX,
  REMINDER_TIME_MIN,
} from "./notification-preferences.schemas";

describe("notificationPreferencesFormSchema - Modulo G, Parte 9", () => {
  it("defaults every new toggle to opted-in (true) when omitted from the form", () => {
    const result = notificationPreferencesFormSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dailyMotivationEnabled).toBe(true);
      expect(result.data.faithMessagesEnabled).toBe(true);
      expect(result.data.habitRemindersEnabled).toBe(true);
      expect(result.data.adminCampaignNotifications).toBe(true);
    }
  });

  it("coerces each new toggle to false when explicitly turned off", () => {
    const result = notificationPreferencesFormSchema.safeParse({
      adminCampaignNotifications: false,
      dailyMotivationEnabled: false,
      faithMessagesEnabled: false,
      habitRemindersEnabled: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dailyMotivationEnabled).toBe(false);
      expect(result.data.faithMessagesEnabled).toBe(false);
      expect(result.data.habitRemindersEnabled).toBe(false);
      expect(result.data.adminCampaignNotifications).toBe(false);
    }
  });

  it("still enforces the 07:00-22:00 daily reminder window (unrelated to the new toggles, but a regression guard)", () => {
    const result = notificationPreferencesFormSchema.safeParse({
      dailyReminderEnabled: true,
      dailyReminderTime: "23:00",
    });
    expect(result.success).toBe(false);
    expect(REMINDER_TIME_MIN).toBe("07:00");
    expect(REMINDER_TIME_MAX).toBe("22:00");
  });
});

describe("NOTIFICATION_PREFERENCES_DEFAULTS - Modulo G, Parte 9", () => {
  it("includes all 4 new keys, matching migration 0053's DB-side default+backfill", () => {
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.daily_motivation_enabled).toBe(true);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.faith_messages_enabled).toBe(true);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.habit_reminders_enabled).toBe(true);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.admin_campaign_notifications).toBe(true);
  });

  it("never drops a pre-existing default key", () => {
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.achievement_notifications).toBe(true);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.challenge_start_notifications).toBe(true);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.new_tip_notifications).toBe(true);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.important_updates_notifications).toBe(true);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.daily_reminder_enabled).toBe(false);
    expect(NOTIFICATION_PREFERENCES_DEFAULTS.push_enabled).toBe(false);
  });
});
