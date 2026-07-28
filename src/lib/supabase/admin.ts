import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getRequiredServiceRoleKey, getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  const env = getServerEnv();

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    getRequiredServiceRoleKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
