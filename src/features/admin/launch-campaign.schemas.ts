import { z } from "zod";

import { LAUNCH_CAMPAIGN_STEP_KEYS } from "@/server/services/admin-challenge-launch-campaign.service";

export const launchCampaignStepFormSchema = z.object({
  enabled: z.coerce.boolean().default(false),
  message: z.string().trim().min(3, "Informe a mensagem.").max(300),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM."),
  stepKey: z.enum(LAUNCH_CAMPAIGN_STEP_KEYS),
  title: z.string().trim().min(2, "Informe o título.").max(120),
});

export type LaunchCampaignStepFormInput = z.infer<typeof launchCampaignStepFormSchema>;

export const launchCampaignStepTestFormSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(320).toLowerCase(),
  stepKey: z.enum(LAUNCH_CAMPAIGN_STEP_KEYS),
});

export type LaunchCampaignStepTestFormInput = z.infer<typeof launchCampaignStepTestFormSchema>;
