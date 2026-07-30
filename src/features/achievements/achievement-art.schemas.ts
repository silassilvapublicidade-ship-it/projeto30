import { z } from "zod";

/**
 * Typed shape of share_templates.config for the two official achievement
 * presets (achievement_story / achievement_feed). Validated on every read so
 * a malformed row in the database can never reach the image renderer with
 * an unexpected shape - it fails loudly instead of rendering garbage.
 */
export const shareCardFormatSchema = z.enum(["story", "feed"]);

export type ShareCardFormat = z.infer<typeof shareCardFormatSchema>;

export const shareCardTemplateConfigSchema = z.object({
  accentColor: z.string().min(1),
  background: z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    type: z.literal("gradient"),
  }),
  format: shareCardFormatSchema,
  height: z.number().int().positive(),
  showChallengeBranding: z.boolean().default(true),
  showFooterSignature: z.boolean().default(true),
  textColor: z.string().min(1),
  width: z.number().int().positive(),
});

export type ShareCardTemplateConfig = z.infer<typeof shareCardTemplateConfigSchema>;

export const TEMPLATE_SLUGS_BY_FORMAT = {
  feed: "achievement_feed",
  story: "achievement_story",
} as const satisfies Record<ShareCardFormat, string>;

export const shareCardFormatParamSchema = z.enum(["story", "feed"]);

export const userAchievementIdSchema = z.uuid("Identificador de conquista invalido.");
