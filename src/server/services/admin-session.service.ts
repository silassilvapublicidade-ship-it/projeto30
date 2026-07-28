import "server-only";

import { redirect } from "next/navigation";

import { isAdminRole, type UserRole } from "@/features/admin/admin-access.core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { requireAuthUser } from "./auth-session.service";

export type AdminUser = {
  email: string;
  id: string;
  role: UserRole;
};

/**
 * Requires an authenticated user whose role (public.users.role, read via the
 * current_user_role() RPC) is admin or super_admin. Non-admin users are sent
 * back to the member area rather than shown any admin-only error detail.
 */
export async function requireAdminUser(nextPath = "/admin"): Promise<AdminUser> {
  const user = await requireAuthUser(nextPath);
  const supabase = await createSupabaseServerClient();
  const { data: role, error } = await supabase.rpc("current_user_role");

  if (error || !isAdminRole(role)) {
    redirect("/app");
  }

  return {
    email: user.email ?? "",
    id: user.id,
    role,
  };
}
