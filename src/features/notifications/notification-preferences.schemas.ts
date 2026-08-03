import { z } from "zod";

// Window explicitly required by the product brief: a daily reminder must
// never fire outside 07:00-22:00, regardless of what a user types.
export const REMINDER_TIME_MIN = "07:00";
export const REMINDER_TIME_MAX = "22:00";

const reminderTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM.")
  .refine((value) => value >= REMINDER_TIME_MIN && value <= REMINDER_TIME_MAX, {
    message: `O horário precisa estar entre ${REMINDER_TIME_MIN} e ${REMINDER_TIME_MAX}.`,
  });

export const notificationPreferencesFormSchema = z.object({
  achievementNotifications: z.coerce.boolean().default(true),
  challengeStartNotifications: z.coerce.boolean().default(true),
  dailyReminderEnabled: z.coerce.boolean().default(false),
  dailyReminderTime: reminderTimeSchema.optional(),
  importantUpdatesNotifications: z.coerce.boolean().default(true),
  newTipNotifications: z.coerce.boolean().default(true),
  pushEnabled: z.coerce.boolean().default(false),
});

export type NotificationPreferencesFormInput = z.infer<typeof notificationPreferencesFormSchema>;

/**
 * Shape stored inside user_preferences.notifications (jsonb) - the DB
 * default (migration 0041) mirrors this exactly so a brand-new row already
 * matches. email/in_app/communication_opt_in are the pre-existing keys
 * (member.actions.ts's onboarding flow) - preserved, never dropped, by
 * always merging over the existing jsonb rather than replacing it.
 */
export type NotificationPreferencesJson = {
  achievement_notifications: boolean;
  challenge_start_notifications: boolean;
  communication_opt_in?: boolean;
  daily_reminder_enabled: boolean;
  email?: boolean;
  important_updates_notifications: boolean;
  in_app?: boolean;
  new_tip_notifications: boolean;
  push_enabled: boolean;
};

export const NOTIFICATION_PREFERENCES_DEFAULTS: NotificationPreferencesJson = {
  achievement_notifications: true,
  challenge_start_notifications: true,
  daily_reminder_enabled: false,
  important_updates_notifications: true,
  new_tip_notifications: true,
  push_enabled: false,
};

// Same fallback used everywhere else in the app when a timezone is
// missing/invalid (journey_get_local_date in SQL, every TS call site per
// the audit) - documented here rather than hidden, per the product brief.
export const FALLBACK_TIMEZONE = "America/Sao_Paulo";
