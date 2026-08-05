import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

const migration = readMigration("0077_user_feedback.sql");
const cockpitMigration = readMigration("0079_feedback_cockpit_summary.sql");

describe("user_feedback table", () => {
  it("has RLS enabled with no direct policies - every access goes through security definer RPCs", () => {
    expect(migration).toContain("alter table public.user_feedback enable row level security");
    expect(migration).not.toContain("on public.user_feedback for");
  });

  it("priority defaults to normal and is never set by the create RPC - only admin can set it", () => {
    expect(migration).toContain("priority text not null default 'normal'");
    const createFn = migration.split("function public.create_user_feedback")[1]?.split("$$;")[0] ?? "";
    expect(createFn).not.toContain("p_priority");
  });

  it("status/priority/category/sentiment/type are all CHECK-constrained to a fixed vocabulary", () => {
    expect(migration).toContain("constraint user_feedback_type_check check (feedback_type in ('problem', 'suggestion', 'rating'))");
    expect(migration).toContain("constraint user_feedback_status_check check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed'))");
    expect(migration).toContain("constraint user_feedback_priority_check check (priority in ('low', 'normal', 'high', 'urgent'))");
  });
});

describe("private attachment bucket", () => {
  it("user-feedback-attachments is created private (public = false) - the first private bucket in the project", () => {
    expect(migration).toContain("values ('user-feedback-attachments', 'user-feedback-attachments', false,");
  });

  it("only JPEG/PNG/WebP are allowed at the Storage level - defense in depth against SVG/PDF/executables", () => {
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
  });

  it("owner-scoped by folder (same convention as avatars), plus admin read access - never public select", () => {
    expect(migration).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    expect(migration).toContain("public.is_admin()");
    expect(migration).not.toMatch(/user_feedback_attachments[\s\S]{0,120}using \(bucket_id = 'user-feedback-attachments'\)\s*;/);
  });
});

describe("create_user_feedback", () => {
  const fn = migration.split("function public.create_user_feedback")[1]?.split("$$;")[0] ?? "";

  it("requires authentication (auth.uid())", () => {
    expect(fn).toContain("if v_user_id is null then");
  });

  it("generates a protocol code that never embeds the user id, and follows the P30-FBK-<date>-<hash> shape", () => {
    expect(fn).toContain("'P30-FBK-' || to_char(now(), 'YYYYMMDD')");
    expect(fn).not.toContain("v_user_id::text || v_protocol");
  });

  it("validates any attachment path is under the caller's own folder - never trusts a client-supplied path blindly", () => {
    expect(fn).toContain("(storage.foldername(p_attachment_storage_path))[1] <> v_user_id::text");
  });

  it("technical fields are only stored when p_include_technical is true", () => {
    expect(fn).toContain("case when p_include_technical then");
  });
});

describe("user_withdraw_feedback", () => {
  const fn = migration.split("function public.user_withdraw_feedback")[1]?.split("$$;")[0] ?? "";

  it("only withdraws the caller's own still-new feedback - never another status, never another user", () => {
    expect(fn).toContain("where id = p_id and user_id = v_user_id and status = 'new'");
  });
});

describe("admin_delete_user_feedback", () => {
  const fn = migration.split("function public.admin_delete_user_feedback")[1]?.split("$$;")[0] ?? "";

  it("is exclusive to super_admin", () => {
    expect(fn).toContain("if v_role <> 'super_admin' then");
  });

  it("returns the attachment path so the caller can remove the Storage object too", () => {
    expect(fn).toContain("select attachment_storage_path into v_attachment_path");
    expect(fn).toContain("return v_attachment_path;");
  });
});

describe("admin_list_user_feedback", () => {
  const fn = migration.split("function public.admin_list_user_feedback")[1]?.split("$$;")[0] ?? "";

  it("never selects email in the listing - only display_name", () => {
    expect(fn).toContain("u.display_name as user_display_name");
    expect(fn).not.toContain("u.email");
  });

  it("is paginated - never loads all rows", () => {
    expect(fn).toContain("limit greatest(least(coalesce(p_limit, 20), 50), 1)");
    expect(fn).toContain("offset greatest(coalesce(p_offset, 0), 0)");
  });
});

describe("system_error_events area whitelist extended with 'feedback'", () => {
  it("table CHECK constraint includes feedback", () => {
    expect(migration).toContain("'pwa', 'app', 'feedback'");
  });

  it("record_system_error keeps the exact 0073 fingerprint formula (area+operation+postgres_code, never the message)", () => {
    const fn = migration.split("function public.record_system_error")[1]?.split("$$;")[0] ?? "";
    expect(fn).toContain("v_fingerprint := md5(p_area || ':' || p_operation || ':' || coalesce(p_postgres_code, ''));");
  });
});

describe("feedback cockpit summary (0079)", () => {
  const fn = cockpitMigration.split("function public.admin_feedback_cockpit_summary")[1]?.split("$$;")[0] ?? "";

  it("never appears in system health status logic - a single negative rating must never degrade the system", () => {
    expect(fn).not.toContain("v_status");
    expect(fn).not.toContain("degradado");
  });

  it("only returns counts, never feedback content", () => {
    expect(fn).not.toContain("description");
    expect(fn).not.toContain("title");
  });
});
