import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];

/**
 * Mirrors public.is_admin() in supabase/migrations/0001_initial_schema.sql.
 * Keep both definitions in sync if the set of admin roles ever changes.
 */
const ADMIN_ROLES: readonly UserRole[] = ["admin", "super_admin"];

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}
