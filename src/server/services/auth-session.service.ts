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
