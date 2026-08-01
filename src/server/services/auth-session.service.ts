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

  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  // "suspended" (Bloquear) fully blocks access, everywhere - this is the
  // single chokepoint nearly every Server Action and page already calls, so
  // it's the only place a block can be enforced without missing Server
  // Actions invoked directly (they never pass through a layout). "inactive"
  // (Desativar) deliberately does NOT block here: it only stops *new*
  // enrollments, already enforced by the existing status = 'active' guards
  // inside join_available_challenge/join_specific_challenge/
  // admin_enroll_user_in_challenge. A missing profile row fails open rather
  // than locking someone out over an infrastructure hiccup.
  if (profile?.status === "suspended" || profile?.status === "deleted") {
    await supabase.auth.signOut();
    redirect("/login?reason=blocked");
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
