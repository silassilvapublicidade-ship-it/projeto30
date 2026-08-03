import { describe, expect, it } from "vitest";

import {
  DAILY_MOTIVATION_CATEGORIES,
  DAILY_MOTIVATION_CATEGORY_LABELS,
  dailyMotivationMessageFormSchema,
  dailyMotivationMessageIdSchema,
} from "./daily-motivation-messages.schemas";

const baseInput = {
  active: true,
  body: "Antes de começar o seu dia, converse com Deus.",
  category: "fe" as const,
  priority: 5,
  title: "Comece com fé",
};

describe("dailyMotivationMessageFormSchema", () => {
  it("accepts a minimal valid message", () => {
    expect(dailyMotivationMessageFormSchema.safeParse(baseInput).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    const result = dailyMotivationMessageFormSchema.safeParse({ ...baseInput, category: "otimismo" });
    expect(result.success).toBe(false);
  });

  it("rejects a body shorter than 3 characters", () => {
    const result = dailyMotivationMessageFormSchema.safeParse({ ...baseInput, body: "Oi" });
    expect(result.success).toBe(false);
  });

  it("rejects endsAt before startsAt", () => {
    const result = dailyMotivationMessageFormSchema.safeParse({
      ...baseInput,
      endsAt: "2026-01-01T00:00",
      startsAt: "2026-06-01T00:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts startsAt/endsAt in order, or both omitted (always eligible)", () => {
    expect(
      dailyMotivationMessageFormSchema.safeParse({
        ...baseInput,
        endsAt: "2026-06-01T00:00",
        startsAt: "2026-01-01T00:00",
      }).success,
    ).toBe(true);
    expect(dailyMotivationMessageFormSchema.safeParse(baseInput).success).toBe(true);
  });

  it("defaults priority to 5 and active to true when omitted", () => {
    const withoutDefaults: Partial<typeof baseInput> = { ...baseInput };
    delete withoutDefaults.active;
    delete withoutDefaults.priority;
    const result = dailyMotivationMessageFormSchema.safeParse(withoutDefaults);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe(5);
      expect(result.data.active).toBe(true);
    }
  });

  it("DAILY_MOTIVATION_CATEGORIES matches exactly the 8 categories from the brief, including 'fe'", () => {
    expect([...DAILY_MOTIVATION_CATEGORIES].sort()).toEqual(
      ["constancia", "disciplina", "fe", "geral", "gratidao", "perseveranca", "proposito", "superacao"].sort(),
    );
  });

  it("every category has a Portuguese display label", () => {
    for (const category of DAILY_MOTIVATION_CATEGORIES) {
      expect(DAILY_MOTIVATION_CATEGORY_LABELS[category]).toBeTruthy();
    }
  });
});

describe("dailyMotivationMessageIdSchema", () => {
  it("accepts a valid uuid", () => {
    expect(dailyMotivationMessageIdSchema.safeParse("9d1a8f7e-1234-4abc-8def-1234567890ab").success).toBe(true);
  });

  it("rejects a non-uuid string", () => {
    expect(dailyMotivationMessageIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
