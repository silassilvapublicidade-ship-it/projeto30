import { z } from "zod";

import { passwordSchema } from "@/features/auth/auth.schemas";

export const firstAccessSchema = z
  .object({
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "A confirmação precisa ser igual à nova senha.",
    path: ["confirmPassword"],
  })
  .refine((data) => !data.currentPassword || data.newPassword !== data.currentPassword, {
    error: "A nova senha precisa ser diferente da senha atual.",
    path: ["newPassword"],
  });

export type FirstAccessInput = z.infer<typeof firstAccessSchema>;
