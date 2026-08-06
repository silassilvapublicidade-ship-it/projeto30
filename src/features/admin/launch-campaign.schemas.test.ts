import { describe, expect, it } from "vitest";

import { launchCampaignStepFormSchema, launchCampaignStepTestFormSchema } from "./launch-campaign.schemas";

describe("launchCampaignStepFormSchema", () => {
  it("accepts a valid step submission", () => {
    const result = launchCampaignStepFormSchema.safeParse({
      enabled: true,
      message: "Faltam 3 dias para o Efatá começar.",
      sendTime: "19:00",
      stepKey: "three_days_before",
      title: "Faltam 3 dias",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown step_key - the 5 steps are fixed, never arbitrary", () => {
    const result = launchCampaignStepFormSchema.safeParse({
      enabled: true,
      message: "Mensagem valida.",
      sendTime: "19:00",
      stepKey: "two_days_before",
      title: "Titulo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed time (must be HH:MM)", () => {
    const result = launchCampaignStepFormSchema.safeParse({
      enabled: true,
      message: "Mensagem valida.",
      sendTime: "7pm",
      stepKey: "launch_day",
      title: "Titulo",
    });
    expect(result.success).toBe(false);
  });

  it("defaults enabled to false when omitted, matching the always-created-disabled seed rule", () => {
    const result = launchCampaignStepFormSchema.safeParse({
      message: "Mensagem valida.",
      sendTime: "09:00",
      stepKey: "launch_day",
      title: "Titulo",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
    }
  });
});

describe("launchCampaignStepTestFormSchema", () => {
  it("accepts a valid email + step_key", () => {
    const result = launchCampaignStepTestFormSchema.safeParse({
      email: "qa@example.com",
      stepKey: "one_day_before",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = launchCampaignStepTestFormSchema.safeParse({
      email: "not-an-email",
      stepKey: "one_day_before",
    });
    expect(result.success).toBe(false);
  });
});
