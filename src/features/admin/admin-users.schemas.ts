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

// "deleted" is intentionally excluded - it's reserved for the historical
// soft-delete column, not a state reachable from the admin UI. The actual
// delete flow is a real (Auth Admin API) hard delete, not a status flip.
export const editableUserStatusSchema = z.enum(["active", "suspended", "inactive"]);

// "user"/"moderator" only - admin_update_user_role's own server-side check
// is the real gate for admin/super_admin (only super_admin may grant or
// revoke those), this just keeps the picker itself from offering options a
// regular admin could never submit successfully anyway.
export const assignableUserRoleSchema = z.enum(["user", "moderator", "admin", "super_admin"]);

export const updateUserStatusSchema = z.object({
  status: editableUserStatusSchema,
  userId: userIdSchema,
});

export const updateUserRoleSchema = z.object({
  role: assignableUserRoleSchema,
  userId: userIdSchema,
});

export const updateUserProfileSchema = z.object({
  city: z.string().trim().max(120, "Use uma cidade mais curta.").optional(),
  displayName: z
    .string()
    .trim()
    .min(2, "Informe um nome de exibição.")
    .max(80, "Use um nome de exibição mais curto."),
  name: z.string().trim().min(2, "Informe o nome completo.").max(120, "Use um nome mais curto."),
  userId: userIdSchema,
});
