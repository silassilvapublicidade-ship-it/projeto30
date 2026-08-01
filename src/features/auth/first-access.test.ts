import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { requiresPasswordReauth } from "./auth.core";
import { firstAccessSchema } from "./first-access.schemas";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("requiresPasswordReauth (amr detection)", () => {
  it("requires reauth when the most recent auth method was a password grant", () => {
    expect(requiresPasswordReauth([{ method: "password", timestamp: 1 }])).toBe(true);
    expect(
      requiresPasswordReauth([
        { method: "otp", timestamp: 1 },
        { method: "password", timestamp: 2 },
      ]),
    ).toBe(true);
  });

  it("skips reauth for magic link / OTP / recovery / oauth sessions - there is no current password to check", () => {
    expect(requiresPasswordReauth([{ method: "otp", timestamp: 1 }])).toBe(false);
    expect(requiresPasswordReauth([{ method: "magiclink", timestamp: 1 }])).toBe(false);
    expect(requiresPasswordReauth([{ method: "recovery", timestamp: 1 }])).toBe(false);
    expect(requiresPasswordReauth([{ method: "oauth", timestamp: 1 }])).toBe(false);
  });

  it("only looks at the most recent method, not the whole history", () => {
    expect(
      requiresPasswordReauth([
        { method: "password", timestamp: 1 },
        { method: "otp", timestamp: 2 },
      ]),
    ).toBe(false);
  });

  it("handles the plain string[] amr shape too", () => {
    expect(requiresPasswordReauth(["password"])).toBe(true);
    expect(requiresPasswordReauth(["otp"])).toBe(false);
  });

  it("fails open (no reauth) instead of throwing on missing/malformed claims", () => {
    expect(requiresPasswordReauth(undefined)).toBe(false);
    expect(requiresPasswordReauth(null)).toBe(false);
    expect(requiresPasswordReauth([])).toBe(false);
    expect(requiresPasswordReauth("password")).toBe(false);
    expect(requiresPasswordReauth([{}])).toBe(false);
  });
});

describe("firstAccessSchema", () => {
  const base = {
    confirmPassword: "novaSenhaForte123",
    currentPassword: undefined as string | undefined,
    newPassword: "novaSenhaForte123",
  };

  it("accepts a valid submission without a current password (magic link path)", () => {
    expect(firstAccessSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid submission with a current password (password login path)", () => {
    const result = firstAccessSchema.safeParse({ ...base, currentPassword: "senhaAntiga123" });
    expect(result.success).toBe(true);
  });

  it("rejects a new password shorter than 8 characters", () => {
    const result = firstAccessSchema.safeParse({
      ...base,
      confirmPassword: "curta",
      newPassword: "curta",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when confirmation does not match the new password", () => {
    const result = firstAccessSchema.safeParse({ ...base, confirmPassword: "outraSenha123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword?.[0]).toBeTruthy();
    }
  });

  it("rejects a new password identical to the provided current password", () => {
    const result = firstAccessSchema.safeParse({
      ...base,
      confirmPassword: "senhaAntiga123",
      currentPassword: "senhaAntiga123",
      newPassword: "senhaAntiga123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.newPassword?.[0]).toBeTruthy();
    }
  });

  it("does not reject equal new/current when currentPassword is absent (nothing to compare against)", () => {
    const result = firstAccessSchema.safeParse({
      ...base,
      confirmPassword: "novaSenhaForte123",
      newPassword: "novaSenhaForte123",
    });
    expect(result.success).toBe(true);
  });
});

describe("AppLayout - server-side must_change_password gate", () => {
  const source = readSource("src", "app", "(member)", "app", "layout.tsx");

  it("checks must_change_password after requireAuthUser, on every request", () => {
    expect(source).toContain("await requireAuthUser(");
    expect(source).toContain("getMustChangePasswordFlag(user.id)");
    expect(source).toContain('redirect("/primeiro-acesso")');
  });

  it("is a Server Component (no client-side trust) - no \"use client\" directive", () => {
    expect(source.trimStart().startsWith('"use client"')).toBe(false);
  });
});

describe("/primeiro-acesso page", () => {
  const source = readSource("src", "app", "(auth)", "primeiro-acesso", "page.tsx");

  it("lives outside the /app layout tree - no loop to guard against by construction", () => {
    // Regression guard: if this ever moves under src/app/(member)/app/**,
    // AppLayout's unconditional redirect would create an infinite loop.
    expect(source).not.toContain("(member)");
  });

  it("re-verifies auth and the flag itself server-side, not just trusting the gate that sent the user here", () => {
    expect(source).toContain("await requireAuthUser(");
    expect(source).toContain("getMustChangePasswordFlag(user.id)");
  });

  it("bounces away once the flag is already false, instead of staying reachable forever", () => {
    expect(source).toContain('redirect("/app")');
  });

  it("only allows logout and a help link as escape hatches, per the brief", () => {
    expect(source).toContain("signOutAndRedirectAction");
    expect(source).toContain("/faq");
  });
});

describe("completeFirstAccessAction", () => {
  const source = readSource("src", "features", "auth", "first-access.actions.ts");

  it("re-checks must_change_password server-side even though the page already redirects away when false", () => {
    expect(source).toContain("await getMustChangePasswordFlag(user.id)");
  });

  it("uses real reauthentication (signInWithPassword), never a simulated check, matching ADR-010", () => {
    expect(source).toContain("supabase.auth.signInWithPassword({");
  });

  it("only asks for the current password when requiresPasswordReauth says so", () => {
    expect(source).toContain("requiresPasswordReauth(claimsData?.claims?.amr)");
  });

  it("clears must_change_password via the admin client, matching the no-self-update-RLS pattern from updateProfileDetailsAction", () => {
    expect(source).toContain("createSupabaseAdminClient()");
    expect(source).toContain("must_change_password: false");
  });

  it("never exposes a raw Supabase error message", () => {
    expect(source).not.toContain("reauthError.message");
    expect(source).not.toContain("updateError.message");
  });
});

describe("updatePasswordAction (recovery) closes the loop with must_change_password", () => {
  const source = readSource("src", "features", "auth", "auth.actions.ts");

  it("clears must_change_password on a successful recovery password update", () => {
    const start = source.indexOf("export async function updatePasswordAction");
    const body = source.slice(start, source.indexOf("\nexport async function signOutAction"));
    expect(body).toContain("must_change_password: false");
  });

  it("treats it as best-effort (recovery must not fail just because this side-update fails)", () => {
    const start = source.indexOf("export async function updatePasswordAction");
    const body = source.slice(start, source.indexOf("\nexport async function signOutAction"));
    expect(body).toContain("try {");
    expect(body).toContain("catch {");
  });
});

describe("Admin: resetUserPasswordAction", () => {
  const source = readSource("src", "features", "admin", "admin-users.actions.ts");

  it("requires an admin session before doing anything", () => {
    const start = source.indexOf("export async function resetUserPasswordAction");
    const body = source.slice(start);
    expect(body).toContain("await requireAdminUser();");
  });

  it("sets the account to require a change on next login", () => {
    const start = source.indexOf("export async function resetUserPasswordAction");
    const body = source.slice(start);
    expect(body).toContain("must_change_password: true");
  });

  it("uses the Auth admin API to actually set the new temporary password", () => {
    const start = source.indexOf("export async function resetUserPasswordAction");
    const body = source.slice(start);
    expect(body).toContain("adminClient.auth.admin.updateUserById(parsedId.data, {");
  });

  it("logs the action to admin_audit_logs without ever including the password", () => {
    const start = source.indexOf("export async function resetUserPasswordAction");
    const body = source.slice(start);
    const insertStart = body.indexOf('.from("admin_audit_logs").insert({');
    const insertBody = body.slice(insertStart, body.indexOf("});", insertStart));
    expect(insertStart).toBeGreaterThan(-1);
    expect(insertBody).toContain('action: "admin_reset_user_password"');
    expect(insertBody).not.toContain("temporaryPassword");
  });

  it("does not redirect - the generated password must never end up in a URL", () => {
    const start = source.indexOf("export async function resetUserPasswordAction");
    const body = source.slice(start);
    expect(body).not.toContain("redirect(");
  });
});

describe("Admin: reset password UI never leaks the value into the URL or a query param", () => {
  const source = readSource("src", "components", "admin", "reset-password-button.tsx");

  it("renders the temporary password from action state, not from a redirect/searchParams", () => {
    expect(source).toContain("state.temporaryPassword");
  });

  it("forces the inner form to remount on close so a stale generated password can't linger", () => {
    expect(source).toContain("setInstanceKey");
    expect(source).toContain("key={instanceKey}");
  });
});
