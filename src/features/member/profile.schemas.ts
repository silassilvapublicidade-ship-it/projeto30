import { z } from "zod";

import { passwordSchema } from "@/features/auth/auth.schemas";

export const profileDetailsSchema = z.object({
  city: z
    .string()
    .trim()
    .max(120, "Use uma cidade mais curta.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  displayName: z
    .string()
    .trim()
    .min(2, "Informe um nome de exibição.")
    .max(80, "Use um nome de exibição mais curto."),
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo.")
    .max(120, "Use um nome mais curto."),
});

export const changePasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
    currentPassword: z.string().min(1, "Informe sua senha atual."),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "A confirmação precisa ser igual à nova senha.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "A nova senha precisa ser diferente da senha atual.",
    path: ["newPassword"],
  });

const ACCEPTED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const AVATAR_EXTENSION_BY_MIME: Record<(typeof ACCEPTED_AVATAR_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export type AvatarValidationResult =
  | { ok: true; extension: string }
  | { ok: false; message: string };

/**
 * Pure validation for an avatar upload, decoupled from the browser File API
 * so it can be unit tested with a plain {type, size} object. Never trusts
 * the original filename - the extension always comes from the validated
 * MIME type, and the storage path is built server-side from auth.uid().
 */
export function validateAvatarUpload(file: {
  size: number;
  type: string;
}): AvatarValidationResult {
  if (file.size <= 0) {
    return { ok: false, message: "O arquivo enviado está vazio." };
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return { ok: false, message: "A imagem precisa ter até 5 MB." };
  }

  if (
    !ACCEPTED_AVATAR_MIME_TYPES.includes(
      file.type as (typeof ACCEPTED_AVATAR_MIME_TYPES)[number],
    )
  ) {
    return {
      ok: false,
      message: "Envie uma imagem em JPEG, PNG ou WebP.",
    };
  }

  return {
    ok: true,
    extension: AVATAR_EXTENSION_BY_MIME[file.type as (typeof ACCEPTED_AVATAR_MIME_TYPES)[number]],
  };
}
