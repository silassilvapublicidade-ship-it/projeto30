import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

const storageMigration = readMigration("0076_storage_audit_and_retention.sql");
const cleanupMigration = readMigration("0078_storage_cleanup_audit_log.sql");

describe("0076 - storage_audit_runs table", () => {
  it("has RLS enabled with no direct policies - every read goes through the admin-gated RPC", () => {
    expect(storageMigration).toContain("alter table public.storage_audit_runs enable row level security");
    expect(storageMigration).not.toMatch(/create policy[\s\S]{0,80}storage_audit_runs/);
  });

  it("stores only a per-run summary (counts + jsonb breakdown), never a row per object", () => {
    expect(storageMigration).toContain("bucket_breakdown jsonb not null default '[]'::jsonb");
    expect(storageMigration).not.toContain("object_path");
  });
});

describe("0076 - admin_preview_system_error_purge", () => {
  it("is read-only (stable) and never selects message_safe/metadata_safe - only counts and dates", () => {
    const fn = storageMigration.split("function public.admin_preview_system_error_purge")[1]?.split("$$;")[0] ?? "";
    expect(fn).toContain("stable");
    expect(fn).not.toContain("message_safe");
    expect(fn).not.toContain("metadata_safe");
  });

  it("any admin (not just super_admin) can preview - matches 'admin comum pode ver o resumo'", () => {
    const fn = storageMigration.split("function public.admin_preview_system_error_purge")[1]?.split("$$;")[0] ?? "";
    expect(fn).toContain("perform public.admin_require_admin();");
    expect(fn).not.toContain("super_admin");
  });

  it("floors retention at 30 days, same guardrail as the original purge RPC", () => {
    const fn = storageMigration.split("function public.admin_preview_system_error_purge")[1]?.split("$$;")[0] ?? "";
    expect(fn).toContain("greatest(coalesce(p_older_than_days, 60), 30)");
  });
});

describe("0076 - admin_purge_old_system_error_events (retention purge, extended)", () => {
  const fn = storageMigration.split("function public.admin_purge_old_system_error_events")[1]?.split("$$;")[0] ?? "";

  it("still requires super_admin and never deletes unresolved events", () => {
    expect(fn).toContain("if v_role <> 'super_admin' then");
    expect(fn).toContain("where status = 'resolved'");
  });

  it("now writes to admin_audit_logs (Parte B: quantidade/cutoff/admin/resultado)", () => {
    expect(fn).toContain("insert into public.admin_audit_logs");
    expect(fn).toContain("'admin_purge_old_system_error_events'");
    expect(fn).toContain("'deletedCount', v_deleted");
  });
});

describe("0078 - admin_log_storage_cleanup", () => {
  const fn = cleanupMigration.split("function public.admin_log_storage_cleanup")[1]?.split("$$;")[0] ?? "";

  it("is exclusive to super_admin", () => {
    expect(fn).toContain("if v_role <> 'super_admin' then");
  });

  it("validates the bucket against the same 5-bucket allowlist - never a free-form bucket name", () => {
    expect(fn).toContain("'avatars', 'challenge-covers', 'tip-cards', 'notification-images', 'achievement-share-cards'");
  });

  it("logs paths/count/size/result but never file content", () => {
    expect(fn).toContain("'paths', p_paths");
    expect(fn).toContain("'deletedCount', p_deleted_count");
    expect(fn).toContain("'freedBytes', p_freed_bytes");
    expect(fn).not.toContain("file_content");
  });
});
