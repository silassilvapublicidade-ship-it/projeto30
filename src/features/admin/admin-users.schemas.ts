import { z } from "zod";

import { emailSchema, passwordSchema } from "@/features/auth/auth.schemas";

export const userIdSchema = z.uuid("Identificador de usuário inválido.");

/**
 * Admin manual creation - only the account itself (name/email/password) and
 * optional first-challenge enrollment. Deliberately excludes photo, goals,
 * weight, height and every other profile field: the round is explicit that
 * those are completed by the member in their own area (the existing
 * onboarding gate already gets them there, since a manually created user
 * starts with onboarding_completed = false like any other new account).
 */
export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .max(120, "O nome informado é longo demais.")
    .optional(),
  email: emailSchema,
  password: passwordSchema,
  mustChangePassword: z.boolean(),
  enrollChallengeId: z.uuid("Desafio inválido.").optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
