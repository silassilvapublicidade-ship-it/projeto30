import { describe, expect, it } from "vitest";

import { habitIdSchema, habitNotificationFormSchema, WEEKDAY_PRESETS } from "./habit-notifications.schemas";

const baseInput = {
  enabled: true,
  frequencyType: "weekly" as const,
  notificationBody: "Beba um copo de água agora.",
  notificationTime: "08:30",
  notificationTitle: "Hora de se hidratar",
  onlyIfNotCompleted: true,
  priority: 5,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
};

describe("habitNotificationFormSchema", () => {
  it("accepts a minimal valid weekly config", () => {
    expect(habitNotificationFormSchema.safeParse(baseInput).success).toBe(true);
  });

  it("rejects a notificationTime outside HH:MM", () => {
    const result = habitNotificationFormSchema.safeParse({ ...baseInput, notificationTime: "25:99" });
    expect(result.success).toBe(false);
  });

  it("requires at least one weekday when frequencyType is weekly", () => {
    const result = habitNotificationFormSchema.safeParse({ ...baseInput, weekdays: [] });
    expect(result.success).toBe(false);
  });

  it("requires monthlyDay when frequencyType is monthly", () => {
    const result = habitNotificationFormSchema.safeParse({
      ...baseInput,
      frequencyType: "monthly",
      monthlyDay: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("accepts monthly with a monthlyDay between 1 and 31", () => {
    const result = habitNotificationFormSchema.safeParse({
      ...baseInput,
      frequencyType: "monthly",
      monthlyDay: 15,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a priority outside 1-10", () => {
    const result = habitNotificationFormSchema.safeParse({ ...baseInput, priority: 11 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid frequencyType", () => {
    const result = habitNotificationFormSchema.safeParse({ ...baseInput, frequencyType: "yearly" });
    expect(result.success).toBe(false);
  });

  it("WEEKDAY_PRESETS.daily/weekdays/weekend cover every day exactly once between them, matching Postgres dow (0=domingo)", () => {
    expect(WEEKDAY_PRESETS.daily).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect([...WEEKDAY_PRESETS.weekdays, ...WEEKDAY_PRESETS.weekend].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("habitIdSchema", () => {
  it("accepts a valid uuid", () => {
    expect(habitIdSchema.safeParse("9d1a8f7e-1234-4abc-8def-1234567890ab").success).toBe(true);
  });

  it("rejects a non-uuid string", () => {
    expect(habitIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
