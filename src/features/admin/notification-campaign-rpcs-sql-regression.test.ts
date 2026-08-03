import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

function sliceFunction(source: string, name: string) {
  const start = source.indexOf(`create or replace function public.${name}`);
  expect(start, `expected to find ${name}`).toBeGreaterThan(-1);
  const nextFn = source.indexOf("create or replace function", start + 10);
  return source.slice(start, nextFn === -1 ? undefined : nextFn);
}

describe("Migration 0045 - notification campaign admin RPCs", () => {
  const migration = readMigration("0045_notification_campaign_admin_rpcs.sql");

  it("resolve_notification_audience always delivers the internal channel to the whole resolved audience, gating only push on subscription+preference", () => {
    const body = sliceFunction(migration, "resolve_notification_audience");
    const pushEligibleClauses = body.match(/exists \(\s*select 1 from public\.push_subscriptions ps/g) ?? [];
    expect(pushEligibleClauses.length).toBeGreaterThanOrEqual(6);
    expect(body).toContain("coalesce((up.notifications ->> 'push_enabled')::boolean, false)");
  });

  it("resolve_notification_audience rejects an unknown audience type instead of silently matching nothing", () => {
    const body = sliceFunction(migration, "resolve_notification_audience");
    expect(body).toContain("raise exception 'Publico invalido: %', p_audience_type using errcode = '22023';");
  });

  it("every admin_* mutation RPC calls admin_require_admin() before touching data", () => {
    const rpcNames = [
      "admin_create_notification_campaign",
      "admin_update_notification_campaign",
      "admin_schedule_notification_campaign",
      "admin_start_notification_campaign_now",
      "admin_cancel_notification_campaign",
      "admin_delete_notification_campaign_draft",
      "admin_duplicate_notification_campaign",
      "admin_get_notification_campaign",
      "admin_list_notification_campaigns",
      "admin_estimate_notification_audience",
    ];
    for (const name of rpcNames) {
      const body = sliceFunction(migration, name);
      expect(body, `${name} missing admin_require_admin()`).toContain("perform public.admin_require_admin();");
    }
  });

  it("admin_create/update_notification_campaign validate title/message length and require at least one channel", () => {
    for (const name of ["admin_create_notification_campaign", "admin_update_notification_campaign"]) {
      const body = sliceFunction(migration, name);
      expect(body).toContain("length(p_title) > 120");
      expect(body).toContain("length(p_message) > 500");
      expect(body).toContain("if not p_channel_internal and not p_channel_push then");
    }
  });

  it("admin_create/update_notification_campaign compute audience_estimated_count from the same resolver used for real sends", () => {
    for (const name of ["admin_create_notification_campaign", "admin_update_notification_campaign"]) {
      const body = sliceFunction(migration, name);
      expect(body).toContain("from public.resolve_notification_audience(p_audience_type, p_challenge_id, p_specific_user_id);");
    }
  });

  it("admin_update/schedule/start_now/cancel/delete all lock the row (for update) before checking status, preventing a lifecycle race", () => {
    for (const name of [
      "admin_update_notification_campaign",
      "admin_schedule_notification_campaign",
      "admin_start_notification_campaign_now",
      "admin_cancel_notification_campaign",
      "admin_delete_notification_campaign_draft",
    ]) {
      const body = sliceFunction(migration, name);
      expect(body, `${name} missing row lock`).toContain("for update;");
    }
  });

  it("admin_update/delete_notification_campaign_draft only ever operate on draft campaigns", () => {
    const update = sliceFunction(migration, "admin_update_notification_campaign");
    expect(update).toContain("if v_status <> 'draft' then");
    const del = sliceFunction(migration, "admin_delete_notification_campaign_draft");
    expect(del).toContain("if v_status <> 'draft' then");
  });

  it("admin_schedule_notification_campaign requires a future date", () => {
    const body = sliceFunction(migration, "admin_schedule_notification_campaign");
    expect(body).toContain("if p_scheduled_for is null or p_scheduled_for <= now() then");
  });

  it("admin_start_notification_campaign_now only flips status to processing - the real send happens elsewhere", () => {
    const body = sliceFunction(migration, "admin_start_notification_campaign_now");
    expect(body).toContain("status = 'processing'");
    expect(body).not.toContain("insert into public.notification_deliveries");
  });

  it("admin_list_notification_campaigns uses %L-quoted dynamic SQL, never raw string concatenation of user input", () => {
    const body = sliceFunction(migration, "admin_list_notification_campaigns");
    expect(body).toContain("return query execute format(");
    expect(body).toContain("%L::text");
    expect(body).not.toMatch(/\|\|\s*p_search\s*\|\|/);
  });

  it("every new RPC revokes public/anon and grants only to authenticated (or service_role for the resolver)", () => {
    expect(migration).toContain(
      "grant execute on function public.resolve_notification_audience(text, uuid, uuid) to authenticated, service_role;",
    );
    expect(migration).toContain(
      "grant execute on function public.admin_create_notification_campaign(text, text, text, text, text, uuid, uuid, text, text, boolean, boolean) to authenticated;",
    );
  });
});
