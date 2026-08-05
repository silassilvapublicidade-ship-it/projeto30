import { z } from "zod";

import {
  categoriesForType,
  FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES,
  FEEDBACK_DESCRIPTION_MAX_LENGTH,
  FEEDBACK_MAX_ATTACHMENT_BYTES,
  FEEDBACK_SENTIMENTS,
  FEEDBACK_TITLE_MAX_LENGTH,
  FEEDBACK_TYPES,
  type FeedbackCategory,
} from "./feedback.core";

const ATTACHMENT_EXTENSION_BY_MIME: Record<(typeof FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type FeedbackAttachmentValidationResult =
  | { extension: string; ok: true }
  | { message: string; ok: false };

export function validateFeedbackAttachmentUpload(file: { size: number; type: string }): FeedbackAttachmentValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: "O arquivo enviado está vazio." };
  }

  if (file.size > FEEDBACK_MAX_ATTACHMENT_BYTES) {
    return { ok: false, message: "A imagem precisa ter até 5 MB." };
  }

  if (!(FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, message: "Envie uma imagem em JPEG, PNG ou WebP." };
  }

  return { ok: true, extension: ATTACHMENT_EXTENSION_BY_MIME[file.type as (typeof FEEDBACK_ALLOWED_ATTACHMENT_MIME_TYPES)[number]] };
}

export const feedbackFormSchema = z
  .object({
    feedbackType: z.enum(FEEDBACK_TYPES),
    category: z.string().optional(),
    title: z.string().trim().min(1, "Escreva um título curto.").max(FEEDBACK_TITLE_MAX_LENGTH),
    description: z.string().trim().min(1, "Descreva o que aconteceu.").max(FEEDBACK_DESCRIPTION_MAX_LENGTH),
    sentiment: z.enum(FEEDBACK_SENTIMENTS).optional(),
    allowContact: z.boolean().default(false),
    includeTechnical: z.boolean().default(true),
    route: z.string().max(300).optional(),
    diagnosticCode: z.string().max(80).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.category) return;
    const allowed = categoriesForType(value.feedbackType) as readonly string[];
    if (allowed.length > 0 && !allowed.includes(value.category)) {
      ctx.addIssue({ code: "custom", message: "Categoria inválida para este tipo.", path: ["category"] });
    }
  });

export type FeedbackFormInput = z.infer<typeof feedbackFormSchema>;

export function normalizedCategory(feedbackType: string, category: string | undefined): FeedbackCategory | undefined {
  if (!category) return undefined;
  return category as FeedbackCategory;
}
