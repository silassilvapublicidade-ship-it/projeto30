import "server-only";

import { z } from "zod";

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("Informe NEXT_PUBLIC_SUPABASE_URL no .env.local."),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "Informe NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local."),
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  AUTH_REDIRECT_URL: z.url().default("http://localhost:3000/auth/callback"),
  SENTRY_DSN: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AUTH_REDIRECT_URL: process.env.AUTH_REDIRECT_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
  });
}

export function getRequiredServiceRoleKey() {
  const key = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não foi configurada.");
  }

  return key;
}
