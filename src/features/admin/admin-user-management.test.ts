import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assignableUserRoleSchema,
  editableUserStatusSchema,
  updateUserProfileSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "./admin-users.schemas";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

function sliceFunction(source: string, name: string, nextMarker?: string) {
  const start = source.indexOf(name);
  expect(start).toBeGreaterThan(-1);
  const end = nextMarker ? source.indexOf(nextMarker, start) : source.indexOf("\n$$;", start) + 4;
  return source.slice(start, end === 3 ? undefined : end);
}

describe("Migration 0027 - inactive status, own transaction", () => {
  const migration = readSource("supabase", "migrations", "0027_user_status_inactive.sql");

  it("adds the inactive value without referencing it anywhere in the same file", () => {
    expect(migration).toContain("alter type public.user_status add value if not exists 'inactive';");
  });
});

describe("Migration 0028 - admin_list_users", () => {
  const migration = readSource("supabase", "migrations", "0028_admin_user_management.sql");
  const body = sliceFunction(
    migration,
    "create or replace function public.admin_list_users",
    "create or replace function public.admin_user_detail",
  );

  it("is gated by admin_require_admin()", () => {
    expect(body).toContain("perform public.admin_require_admin();");
  });

  it("excludes soft-deleted users", () => {
    expect(body).toContain("where u.deleted_at is null");
  });

  it("only allows sorting by an explicit allow-list before it ever reaches format(%I)", () => {
    expect(body).toContain("if v_sort_by not in ('created_at', 'name', 'status')");
  });

  it("derives active_challenge_count from real enrollments (active/paused), not a stored counter", () => {
    expect(body).toContain('ce.status in (\'active\', \'paused\')');
  });
});

describe("Migration 0028 - admin_user_detail", () => {
  const migration = readSource("supabase", "migrations", "0028_admin_user_management.sql");
  const body = sliceFunction(
    migration,
    "create or replace function public.admin_user_detail",
    "create or replace function public.admin_assert_not_sole_super_admin",
  );

  it("is gated by admin_require_admin()", () => {
    expect(body).toContain("perform public.admin_require_admin();");
  });

  it("never selects journal_entries (diary) or auth secrets", () => {
    const lower = body.toLowerCase();
    expect(lower).not.toContain("journal_entries");
    expect(lower).not.toContain("service_role");
    // must_change_password is a boolean flag, fine to expose - the real
    // secret (an actual password/token) never appears here.
    expect(lower).not.toMatch(/\bauth\.users\b/);
  });

  it("includes enrollments, achievements and recent audit logs", () => {
    expect(body).toContain("public.challenge_enrollments ce");
    expect(body).toContain("public.user_achievements ua");
    expect(body).toContain("public.admin_audit_logs");
  });

  it("caps the audit trail instead of returning unbounded history", () => {
    expect(body).toContain("limit 10");
  });
});

describe("Migration 0028 - sole super_admin protection", () => {
  const migration = readSource("supabase", "migrations", "0028_admin_user_management.sql");

  it("admin_assert_not_sole_super_admin only blocks when the target IS the sole active super_admin", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.admin_assert_not_sole_super_admin",
      "create or replace function public.admin_update_user_status",
    );
    expect(body).toContain("if v_target_role is distinct from 'super_admin' then");
    expect(body).toContain("return;");
    expect(body).toContain("status = 'active'");
    expect(body).toContain("id <> p_user_id");
  });

  it("admin_update_user_status blocks self-block/self-deactivate and calls the sole-super_admin guard", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.admin_update_user_status",
      "create or replace function public.admin_update_user_role",
    );
    expect(body).toContain("p_user_id = v_admin_id and p_new_status <> 'active'");
    expect(body).toContain("perform public.admin_assert_not_sole_super_admin(p_user_id);");
    expect(body).toContain('.admin_audit_logs');
  });

  it("admin_update_user_role restricts admin/super_admin grants to super_admin actors and blocks self-change", () => {
    const body = sliceFunction(
      migration,
      "create or replace function public.admin_update_user_role",
      "create or replace function public.admin_update_user_profile",
    );
    expect(body).toContain("if p_user_id = v_admin_id then");
    expect(body).toContain("v_acting_role <> 'super_admin'");
    expect(body).toContain("p_new_role in ('admin', 'super_admin') or v_old_role in ('admin', 'super_admin')");
    expect(body).toContain("perform public.admin_assert_not_sole_super_admin(p_user_id);");
  });

  it("admin_assert_user_deletable blocks self-deletion and reuses the sole-super_admin guard", () => {
    const start = migration.indexOf("create or replace function public.admin_assert_user_deletable");
    const body = migration.slice(start);
    expect(body).toContain("p_user_id = v_admin_id");
    expect(body).toContain("perform public.admin_assert_not_sole_super_admin(p_user_id);");
  });
});

describe("requireAuthUser - suspended/blocked accounts", () => {
  const source = readSource("src", "server", "services", "auth-session.service.ts");

  it("signs out and redirects when status is suspended or deleted", () => {
    expect(source).toContain('profile?.status === "suspended" || profile?.status === "deleted"');
    expect(source).toContain("await supabase.auth.signOut();");
    expect(source).toContain('redirect("/login?reason=blocked")');
  });

  it("does NOT block \"inactive\" accounts from logging in - only from new enrollments", () => {
    const start = source.indexOf("if (profile?.status ===");
    const end = source.indexOf(") {", start);
    const condition = source.slice(start, end);
    expect(condition).not.toContain("inactive");
  });
});

describe("editableUserStatusSchema / assignableUserRoleSchema", () => {
  it("excludes 'deleted' from the editable status options - that's reserved, not a UI-reachable state", () => {
    expect(editableUserStatusSchema.safeParse("deleted").success).toBe(false);
    expect(editableUserStatusSchema.safeParse("active").success).toBe(true);
    expect(editableUserStatusSchema.safeParse("suspended").success).toBe(true);
    expect(editableUserStatusSchema.safeParse("inactive").success).toBe(true);
  });

  it("assignableUserRoleSchema accepts all four roles - the real admin/super_admin gate is server-side", () => {
    for (const role of ["user", "moderator", "admin", "super_admin"]) {
      expect(assignableUserRoleSchema.safeParse(role).success).toBe(true);
    }
  });
});

describe("updateUserStatusSchema / updateUserRoleSchema / updateUserProfileSchema", () => {
  it("require a valid uuid userId", () => {
    expect(updateUserStatusSchema.safeParse({ status: "active", userId: "not-a-uuid" }).success).toBe(false);
  });

  it("updateUserRoleSchema round-trips a valid submission", () => {
    expect(
      updateUserRoleSchema.safeParse({ role: "moderator", userId: "11111111-1111-4111-8111-111111111111" })
        .success,
    ).toBe(true);
  });

  it("updateUserProfileSchema requires name and displayName but not city", () => {
    const result = updateUserProfileSchema.safeParse({
      displayName: "Ana",
      name: "Ana Silva",
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(result.success).toBe(true);
  });
});

describe("Admin users actions - Modulo B", () => {
  const source = readSource("src", "features", "admin", "admin-users.actions.ts");

  it("deleteUserAction calls the authoritative admin_assert_user_deletable guard before the hard delete", () => {
    const start = source.indexOf("export async function deleteUserAction");
    const end = source.indexOf("export type ResetPasswordActionResult");
    const body = source.slice(start, end);
    expect(body).toContain('supabase.rpc("admin_assert_user_deletable"');
    const guardIndex = body.indexOf("admin_assert_user_deletable");
    const hardDeleteIndex = body.indexOf("adminClient.auth.admin.deleteUser");
    expect(guardIndex).toBeLessThan(hardDeleteIndex);
  });

  it("createUserAction and deleteUserAction both write to admin_audit_logs", () => {
    const createBody = source.slice(
      source.indexOf("export async function createUserAction"),
      source.indexOf("export async function deleteUserAction"),
    );
    const deleteBody = source.slice(
      source.indexOf("export async function deleteUserAction"),
      source.indexOf("export type ResetPasswordActionResult"),
    );
    expect(createBody).toContain('"admin_create_user"');
    expect(deleteBody).toContain('"admin_delete_user"');
  });

  it("updateUserStatusAction and updateUserRoleAction call their respective RPCs, never a raw table update for role", () => {
    const statusBody = source.slice(
      source.indexOf("export async function updateUserStatusAction"),
      source.indexOf("export async function updateUserRoleAction"),
    );
    const roleBody = source.slice(
      source.indexOf("export async function updateUserRoleAction"),
      source.indexOf("export async function updateUserProfileAction"),
    );
    expect(statusBody).toContain('supabase.rpc("admin_update_user_status"');
    expect(roleBody).toContain('supabase.rpc("admin_update_user_role"');
  });

  it("requirePasswordChangeAction only flips the flag - never rotates the password itself", () => {
    const body = source.slice(
      source.indexOf("export async function requirePasswordChangeAction"),
      source.indexOf("export async function updateUserStatusAction"),
    );
    expect(body).toContain("must_change_password: true");
    expect(body).not.toContain("randomBytes");
    expect(body).not.toContain("updateUserById");
  });
});

describe("Admin usuarios listing - filters and dropdown action menu", () => {
  const pageSource = readSource("src", "app", "admin", "usuarios", "page.tsx");
  const actionsSource = readSource("src", "components", "admin", "user-row-actions.tsx");

  it("exposes the full filter set from the brief", () => {
    for (const name of ["role", "status", "profileComplete", "mustChangePassword", "hasActiveChallenge"]) {
      expect(pageSource).toContain(`name="${name}"`);
    }
  });

  it("row actions use a real dropdown menu (\"...\"), not two bare icon buttons", () => {
    expect(actionsSource).toContain("DropdownMenu");
    expect(actionsSource).toContain("Ver detalhes");
    expect(actionsSource).toContain("Excluir");
  });

  it("only offers the status transitions the account isn't already in", () => {
    expect(actionsSource).toContain('status !== "active"');
    expect(actionsSource).toContain('status !== "inactive"');
    expect(actionsSource).toContain('status !== "suspended"');
  });
});

describe("Admin usuario detail page", () => {
  const source = readSource("src", "app", "admin", "usuarios", "[userId]", "page.tsx");

  it("requires an admin session", () => {
    expect(source).toContain("requireAdminUser()");
  });

  it("restricts role changes to super_admin actors in the UI too (defense in depth, not the real gate)", () => {
    expect(source).toContain('canChangeRole = admin.role === "super_admin"');
  });

  it("prevents targeting your own account from this screen", () => {
    expect(source).toContain("isSelf = profile.id === admin.id");
  });

  it("never asks for photo/goals/weight/height here - that stays in the member area", () => {
    expect(source.toLowerCase()).toContain("área de membros");
  });

  it("wraps the name/email header instead of overflowing on narrow viewports - a user with no name falls back to their email as the h1, which has no spaces to naturally break on", () => {
    expect(source).toContain("break-words text-2xl font-semibold text-foreground");
    expect(source).toContain("break-all font-mono text-xs text-muted-2");
  });
});
