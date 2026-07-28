import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(320, "O e-mail informado é longo demais.")
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(128, "A senha informada é longa demais.");

export const passwordAuthSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const magicLinkSchema = z.object({
  email: emailSchema,
});
