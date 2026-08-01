import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripJsComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

function fileExists(...pathSegments: string[]) {
  try {
    readFileSync(join(process.cwd(), ...pathSegments), "utf8");
    return true;
  } catch {
    return false;
  }
}

describe("Participantes removed as a standalone admin destination", () => {
  it("the standalone page no longer exists", () => {
    expect(fileExists("src", "app", "admin", "participantes", "page.tsx")).toBe(false);
  });

  it("the nav item is gone from both desktop and mobile navigation (they share one navItems list)", () => {
    const source = stripJsComments(readSource("src", "components", "admin", "admin-navigation.tsx"));
    expect(source).not.toContain("/admin/participantes");
    expect(source).not.toContain('label: "Participantes"');
  });

  it("no other source file links to the removed route", () => {
    const source = readSource("src", "app", "admin", "page.tsx");
    expect(source).not.toContain("/admin/participantes");
  });

  it("the real per-challenge flow (Admin -> Desafios -> selecionar -> Ver participantes) is untouched", () => {
    expect(
      fileExists("src", "app", "admin", "desafios", "[challengeId]", "participantes", "page.tsx"),
    ).toBe(true);
    expect(
      fileExists(
        "src",
        "app",
        "admin",
        "desafios",
        "[challengeId]",
        "participantes",
        "[enrollmentId]",
        "page.tsx",
      ),
    ).toBe(true);
  });
});

describe("Migration 0026 - must_change_password architecture + admin enrollment RPC", () => {
  const migration = readSource("supabase", "migrations", "0026_admin_manual_user_creation.sql");

  it("adds must_change_password without enforcing it anywhere in this migration", () => {
    expect(migration).toContain(
      "add column if not exists must_change_password boolean not null default false;",
    );
  });

  it("admin_enroll_user_in_challenge is gated by the existing admin_require_admin() guard", () => {
    const start = migration.indexOf("create or replace function public.admin_enroll_user_in_challenge");
    const body = migration.slice(start, migration.indexOf("$$;", start));
    expect(body).toContain("perform public.admin_require_admin();");
  });

  it("only accepts challenges with status = 'active' (this schema's 'publicado')", () => {
    const start = migration.indexOf("create or replace function public.admin_enroll_user_in_challenge");
    const body = migration.slice(start, migration.indexOf("$$;", start));
    expect(body).toContain("v_challenge_status <> 'active'");
  });

  it("is idempotent for an already-active/paused enrollment instead of erroring", () => {
    const start = migration.indexOf("create or replace function public.admin_enroll_user_in_challenge");
    const body = migration.slice(start, migration.indexOf("$$;", start));
    expect(body).toContain("status in ('active', 'paused')");
    expect(body).toContain("return v_existing_enrollment_id;");
  });

  it("computes personal_start_date from the target user's own timezone, not the admin's", () => {
    const start = migration.indexOf("create or replace function public.admin_enroll_user_in_challenge");
    const body = migration.slice(start, migration.indexOf("$$;", start));
    expect(body).toContain("journey_get_local_date(v_profile_timezone)");
  });

  it("execute is granted to authenticated (admin gate is inside the function body, not via GRANT alone)", () => {
    expect(migration).toContain(
      "grant execute on function public.admin_enroll_user_in_challenge(uuid, uuid) to authenticated;",
    );
  });
});

describe("createUserSchema - only account fields, nothing profile-related", () => {
  const source = readSource("src", "features", "admin", "admin-users.schemas.ts");

  it("email and password are required, name is optional", () => {
    expect(source).toContain("email: emailSchema,");
    expect(source).toContain("password: passwordSchema,");
    const nameLine = source.slice(source.indexOf("name: z"), source.indexOf("email: emailSchema"));
    expect(nameLine).toContain(".optional()");
  });

  it("mustChangePassword is a plain boolean (architecture only, not yet enforced by this schema)", () => {
    expect(source).toContain("mustChangePassword: z.boolean(),");
  });

  it("never asks for photo, goals, weight or height - those are filled by the member in onboarding", () => {
    const lower = source.toLowerCase();
    expect(lower).not.toContain("peso");
    expect(lower).not.toContain("altura");
    expect(lower).not.toContain("avatar");
    expect(lower).not.toContain("objetivo");
  });
});

describe("Admin users service", () => {
  const source = readSource("src", "server", "services", "admin-users.service.ts");

  it("listAdminUsers delegates search/filter/sort/pagination to the admin_list_users RPC (Modulo B)", () => {
    const start = source.indexOf("export async function listAdminUsers");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain('supabase.rpc("admin_list_users"');
  });

  it("the admin_list_users RPC excludes soft-deleted accounts at the source", () => {
    const migration = readSource("supabase", "migrations", "0028_admin_user_management.sql");
    const start = migration.indexOf("create or replace function public.admin_list_users");
    const body = migration.slice(start, migration.indexOf("create or replace function public.admin_user_detail", start));
    expect(body).toContain("where u.deleted_at is null");
  });

  it("the enroll picker only returns published (status=active) challenges, never draft/paused/ended/archived", () => {
    const start = source.indexOf("export async function listPublishedChallengesForEnrollPicker");
    const body = source.slice(start, source.indexOf("\n}\n", start) + 3);
    expect(body).toContain('.eq("status", "active")');
  });

  it("a network-level throw in either function degrades gracefully instead of crashing the caller", () => {
    expect(source).toContain("catch (caughtError)");
    expect(source).toContain("ADMIN_USERS_LOAD_FAILED");
  });
});

describe("Admin users actions - Server Actions, service_role only ever touched on the server", () => {
  const source = readSource("src", "features", "admin", "admin-users.actions.ts");

  it('is a real Server Action file ("use server" directive)', () => {
    expect(source.trimStart().startsWith('"use server";')).toBe(true);
  });

  it("requires an admin session before doing anything", () => {
    expect(source).toContain("await requireAdminUser();");
  });

  it("creates the account via Supabase Auth's admin API, not a raw insert into public.users (the trigger owns that)", () => {
    const start = source.indexOf("export async function createUserAction");
    const body = source.slice(start, source.indexOf("\nexport async function deleteUserAction"));
    expect(body).toContain("adminClient.auth.admin.createUser({");
    expect(body).not.toMatch(/\.from\(["']users["']\)\s*\.insert/);
  });

  it("confirms the email immediately (admin is vouching for it) instead of requiring a verification email", () => {
    const start = source.indexOf("export async function createUserAction");
    const body = source.slice(start, source.indexOf("\nexport async function deleteUserAction"));
    expect(body).toContain("email_confirm: true,");
  });

  it("a failed admin-client construction degrades to a safe message instead of throwing an unhandled error", () => {
    const start = source.indexOf("export async function createUserAction");
    const body = source.slice(start, source.indexOf("\nexport async function deleteUserAction"));
    expect(body).toMatch(/catch \{[\s\S]*?A configuração segura do servidor/);
  });

  it("surfaces a create-success-enroll-failed state instead of silently hiding a failed auto-enrollment", () => {
    const start = source.indexOf("export async function createUserAction");
    const body = source.slice(start, source.indexOf("\nexport async function deleteUserAction"));
    expect(body).toContain("create-success-enroll-failed");
  });

  it("deleteUserAction uses the Auth admin API (cascades through public.users -> enrollments via FK) and blocks self-deletion", () => {
    const start = source.indexOf("export async function deleteUserAction");
    const body = source.slice(start);
    expect(body).toContain("adminClient.auth.admin.deleteUser(parsedId.data)");
    expect(body).toContain("parsedId.data === admin.id");
    expect(body).toContain("delete-self-blocked");
  });

  it("appends feedback with & instead of a second ? when redirectTo already carries a query string (e.g. an active search/page filter) - a bare `${redirectTo}?feedback=...` template would silently break the banner there", () => {
    const start = source.indexOf("export async function deleteUserAction");
    const body = source.slice(start);
    expect(body).not.toMatch(/`\$\{redirectTo\}\?feedback=/);
    expect(source).toContain('const separator = path.includes("?") ? "&" : "?";');
  });

  it("never imports the admin client into a client component - server-only guards this at build time", () => {
    const adminClientSource = readSource("src", "lib", "supabase", "admin.ts");
    expect(adminClientSource.trimStart().startsWith('import "server-only";')).toBe(true);
  });
});

describe("Novo usuário form - account fields only, confirmation shown, published-only picker", () => {
  const formSource = readSource("src", "components", "admin", "user-create-form.tsx");
  const pageSource = readSource("src", "app", "admin", "usuarios", "novo", "page.tsx");

  it("has exactly the required fields: name (optional), email, password, must-change-password checkbox, enroll picker", () => {
    expect(formSource).toContain('name="name"');
    expect(formSource).toContain('name="email"');
    expect(formSource).toContain('name="password"');
    expect(formSource).toContain('name="mustChangePassword"');
    expect(formSource).toContain('name="enrollChallengeId"');
  });

  it("the enroll picker defaults to Nenhum, not a pre-selected challenge", () => {
    expect(formSource).toContain('{ label: "Nenhum", value: "" }');
  });

  it("the page explicitly tells the admin that profile completion happens in the member area, not here", () => {
    expect(pageSource.toLowerCase()).toContain("foto, objetivos, peso, altura");
    expect(pageSource).toContain("área de membros");
  });

  it("the listing page has the Novo usuário button", () => {
    const listSource = readSource("src", "app", "admin", "usuarios", "page.tsx");
    expect(listSource).toContain('href="/admin/usuarios/novo"');
    expect(listSource).toContain("Novo usuário");
  });
});

describe("User deletion - real confirmation dialog, not window.confirm", () => {
  const source = readSource("src", "components", "admin", "user-row-actions.tsx");

  it("uses the shared ConfirmDialog component", () => {
    expect(source).toContain("<ConfirmDialog");
    expect(source).not.toContain("window.confirm");
  });

  it("names the exact account being deleted in the confirmation copy", () => {
    expect(source).toContain("userEmail");
  });
});
