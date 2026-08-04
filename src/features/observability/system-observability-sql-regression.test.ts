import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

const schemaMigration = readMigration("0072_system_observability.sql");
const fixMigration = readMigration("0073_system_observability_fingerprint_fix.sql");

describe("0072_system_observability.sql - table and RLS", () => {
  it("creates system_error_events with RLS enabled and no policies (deny by default, everything through RPCs)", () => {
    expect(schemaMigration).toContain("create table if not exists public.system_error_events");
    expect(schemaMigration).toContain("alter table public.system_error_events enable row level security;");
    expect(schemaMigration).not.toMatch(/create policy .* on public\.system_error_events/);
  });

  it("enforces the area/severity/status whitelists via CHECK constraints, not just application code", () => {
    expect(schemaMigration).toContain("constraint system_error_events_area_check check (area in (");
    expect(schemaMigration).toContain("constraint system_error_events_severity_check check (severity in ('info', 'warning', 'error', 'critical'))");
    expect(schemaMigration).toContain("constraint system_error_events_status_check check (status in ('open', 'investigating', 'resolved'))");
  });

  it("caps message/note length and metadata size at the database level too", () => {
    expect(schemaMigration).toContain("constraint system_error_events_message_length check (char_length(message_safe) <= 500)");
    expect(schemaMigration).toContain("constraint system_error_events_metadata_size check (octet_length(metadata_safe::text) <= 2000)");
  });

  it("has a unique index on fingerprint - the grouping key", () => {
    expect(schemaMigration).toContain("create unique index if not exists system_error_events_fingerprint_key");
    expect(schemaMigration).toContain("on public.system_error_events (fingerprint);");
  });
});

describe("record_system_error (defined in 0073, the corrected version)", () => {
  const fn = fixMigration.split("function public.record_system_error")[1]?.split("$$;")[0] ?? "";

  it("is security definer with a locked-down search_path", () => {
    expect(fixMigration).toContain("create or replace function public.record_system_error");
    expect(fn).toContain("security definer");
    expect(fixMigration).toContain("set search_path = public, pg_temp");
  });

  it("only service_role can execute it - never anon or authenticated", () => {
    const grantLine = fixMigration.split("\n").find((line) => line.includes("grant execute on function public.record_system_error"));
    expect(grantLine).toContain("to service_role;");
    expect(fixMigration).toContain(
      "revoke execute on function public.record_system_error(text, text, text, text, text, text, uuid, jsonb, text) from public, anon, authenticated;",
    );
  });

  it("computes the fingerprint from area + operation + postgres_code only - never from the message text", () => {
    const fingerprintLine = fn.split("\n").find((line) => line.includes("v_fingerprint := md5("));
    expect(fingerprintLine).toBeDefined();
    expect(fingerprintLine).toContain("p_area || ':' || p_operation || ':' || coalesce(p_postgres_code, '')");
    expect(fingerprintLine).not.toMatch(/message/i);
  });

  it("upserts on conflict(fingerprint), incrementing occurrence_count - never a new row per repeat", () => {
    expect(fn).toContain("on conflict (fingerprint) do update set");
    expect(fn).toContain("occurrence_count = see.occurrence_count + 1");
  });

  it("rejects forbidden patterns in message, metadata and operation before ever writing a row", () => {
    expect(fn).toContain("_system_error_text_is_safe(v_message)");
    expect(fn).toContain("_system_error_text_is_safe(v_normalized_metadata::text)");
    expect(fn).toContain("_system_error_text_is_safe(p_operation)");
  });

  it("rejects an area outside the fixed whitelist even before hitting the table CHECK constraint", () => {
    expect(fn).toContain("if p_area is null or p_area not in (");
  });

  it("builds the diagnostic code as P30-<AREA>-<YYYYMMDD>-<hash>, matching the documented format", () => {
    expect(fn).toContain("v_error_code := 'P30-' || v_area_short || '-' || to_char(now(), 'YYYYMMDD') || '-' || upper(left(v_fingerprint, 4));");
  });
});

describe("_system_error_text_is_safe - forbidden pattern guard", () => {
  it("blocks password/token/cookie/authorization/service_role/api_key/email-like patterns", () => {
    const fn = schemaMigration.split("function public._system_error_text_is_safe")[1]?.split("$$;")[0] ?? "";
    expect(fn).toMatch(/password|senha/);
    expect(fn).toMatch(/token/);
    expect(fn).toMatch(/cookie/);
    expect(fn).toMatch(/authorization/);
    expect(fn).toMatch(/service_role/);
    expect(fn).toMatch(/api\[_-\]\?key/);
  });
});

describe("admin_list_system_error_events / admin_get_system_error_event - column redaction", () => {
  it("redacts postgres_code, user_id and metadata_safe for anyone below super_admin", () => {
    const listFn = schemaMigration.split("function public.admin_list_system_error_events")[1]?.split("$$;")[0] ?? "";
    expect(listFn).toContain('case when v_role = \'super_admin\' then e.postgres_code else null end');
    expect(listFn).toContain('case when v_role = \'super_admin\' then e.user_id else null end');
    expect(listFn).toContain("case when v_role = 'super_admin' then e.metadata_safe else '{}'::jsonb end");

    const getFn = schemaMigration.split("function public.admin_get_system_error_event")[1]?.split("$$;")[0] ?? "";
    expect(getFn).toContain('case when v_role = \'super_admin\' then e.postgres_code else null end');
    expect(getFn).toContain('case when v_role = \'super_admin\' then e.user_id else null end');
  });

  it("both are gated by admin_require_admin() - a non-admin can never call them at all", () => {
    const listFn = schemaMigration.split("function public.admin_list_system_error_events")[1]?.split("$$;")[0] ?? "";
    const getFn = schemaMigration.split("function public.admin_get_system_error_event")[1]?.split("$$;")[0] ?? "";
    expect(listFn).toContain("public.admin_require_admin()");
    expect(getFn).toContain("public.admin_require_admin()");
  });

  it("caps the page size server-side, never trusting a client-supplied limit", () => {
    const listFn = schemaMigration.split("function public.admin_list_system_error_events")[1]?.split("$$;")[0] ?? "";
    expect(listFn).toContain("v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);");
  });
});

describe("admin_resolve_system_error_event - super_admin only, audited", () => {
  const fn = schemaMigration.split("function public.admin_resolve_system_error_event")[1]?.split("$$;")[0] ?? "";

  it("rejects any role other than super_admin, even though admin_require_admin() alone would let a plain admin through", () => {
    expect(fn).toContain("if v_role <> 'super_admin' then");
    expect(fn).toMatch(/errcode = '42501'/);
  });

  it("never deletes the row - only updates status/resolution fields", () => {
    expect(fn).not.toContain("delete from public.system_error_events");
    expect(fn).toContain("update public.system_error_events");
  });

  it("writes an admin_audit_logs entry with before/after status, reusing the existing audit table", () => {
    expect(fn).toContain('insert into public.admin_audit_logs');
    expect(fn).toContain("'admin_resolve_system_error_event'");
  });

  it("clears resolved_at/resolved_by when moving away from resolved (supports reabrir)", () => {
    expect(fn).toContain("resolved_at = case when p_status = 'resolved' then now() else null end");
    expect(fn).toContain("resolved_by = case when p_status = 'resolved' then v_actor_id else null end");
  });
});

describe("admin_purge_old_system_error_events - retention, never touches unresolved rows", () => {
  const fn = schemaMigration.split("function public.admin_purge_old_system_error_events")[1]?.split("$$;")[0] ?? "";

  it("only deletes resolved rows older than the retention window", () => {
    expect(fn).toContain("where status = 'resolved'");
    expect(fn).toContain("and resolved_at < now() - make_interval(days => v_days)");
  });

  it("is super_admin only", () => {
    expect(fn).toContain("if v_role <> 'super_admin' then");
  });

  it("floors the retention window at 30 days - never an accidental 0-day purge of everything", () => {
    expect(fn).toContain("v_days integer := greatest(coalesce(p_older_than_days, 60), 30);");
  });
});

describe("admin_get_system_health_overview - derives from existing tables, no duplicated data", () => {
  const fn = schemaMigration.split("function public.admin_get_system_health_overview")[1]?.split("$$;")[0] ?? "";

  it("reads notification_campaigns/notification_deliveries/push_subscriptions/users directly, not a cached copy", () => {
    expect(fn).toContain("from public.notification_campaigns");
    expect(fn).toContain("from public.notification_deliveries");
    expect(fn).toContain("from public.push_subscriptions");
    expect(fn).toContain("from public.users");
  });

  it("documents objective status criteria in comments, not just a magic priority chain", () => {
    expect(fn).toMatch(/Critico:/);
    expect(fn).toMatch(/Degradado:/);
    expect(fn).toMatch(/Atencao:/);
    expect(fn).toMatch(/Saudavel:/);
  });

  it("treats a cron that has never run the same as a critically stale one", () => {
    expect(fn).toContain("coalesce((v_last_cron->>'lastSeenAt')::timestamptz, 'epoch'::timestamptz) < now() - interval '36 hours'");
  });

  it("is gated by admin_require_admin()", () => {
    expect(fn).toContain("public.admin_require_admin()");
  });
});
