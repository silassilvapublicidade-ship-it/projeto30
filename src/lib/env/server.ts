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
  // Web Push (Modulo F). VAPID_PRIVATE_KEY must never be read outside this
  // server-only module - see src/server/services/web-push.service.ts, the
  // only consumer. NEXT_PUBLIC_VAPID_PUBLIC_KEY is duplicated here (also
  // readable client-side via src/lib/env/client.ts) only so the server can
  // validate both halves of the keypair are present together.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalSecret,
  VAPID_PRIVATE_KEY: optionalSecret,
  VAPID_SUBJECT: optionalSecret,
  // Bearer secret required on every call to /api/cron/notifications/process
  // - Vercel Cron sends it automatically once configured as this project's
  // cron secret; also lets an authorized external pinger trigger the same
  // endpoint if the Vercel plan's cron frequency is too coarse (see
  // vercel.json comment).
  CRON_CONTROL_SECRET: optionalSecret,
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
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    CRON_CONTROL_SECRET: process.env.CRON_CONTROL_SECRET,
  });
}

export function getRequiredServiceRoleKey() {
  const key = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não foi configurada.");
  }

  return key;
}

export type VapidConfig = { privateKey: string; publicKey: string; subject: string };

/**
 * Throws with a precise, actionable message when any of the 3 VAPID values
 * is missing - fail fast at the call site (push-sending code) rather than
 * sending a malformed request to the push service.
 */
export function getRequiredVapidConfig(): VapidConfig {
  const env = getServerEnv();

  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error(
      "VAPID nao configurado: defina NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.",
    );
  }

  return {
    privateKey: env.VAPID_PRIVATE_KEY,
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

export function getRequiredCronControlSecret() {
  const secret = getServerEnv().CRON_CONTROL_SECRET;

  if (!secret) {
    throw new Error("CRON_CONTROL_SECRET não foi configurada.");
  }

  return secret;
}
