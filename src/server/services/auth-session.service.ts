import "server-only";

import { redirect } from "next/navigation";

import { getSafeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOptionalAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireAuthUser(nextPath = "/app") {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const safeNext = encodeURIComponent(getSafeNextPath(nextPath));
    redirect(`/login?next=${safeNext}&reason=session`);
  }

  return user;
}

/**
 * Reads must_change_password for the given user via the session-scoped
 * client ("Users can read own profile" already covers this). Defaults to
 * false on any read failure so an infrastructure hiccup never turns into an
 * unrecoverable redirect loop for every /app/* request.
 */
export async function getMustChangePasswordFlag(userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("users")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();

  return data?.must_change_password ?? false;
}
