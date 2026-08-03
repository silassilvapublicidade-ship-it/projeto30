import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

describe("Migration 0041 - notifications core schema", () => {
  const migration = readMigration("0041_notifications_core_schema.sql");

  it("replaces the old direct-UPDATE policy with RPC-only mutation", () => {
    expect(migration).toContain('drop policy if exists "Users can mark own notifications read"');
    expect(migration).toContain("drop trigger if exists enforce_notification_user_read_update");
  });

  it("constrains destination_type to the shared allowlist on both notifications and campaigns", () => {
    const allowlist =
      "'hoje', 'desafios', 'desafio', 'jornada', 'dicas', 'dica',\n      'conquistas', 'notificacoes', 'configuracoes_notificacoes'";
    expect(migration).toContain(allowlist);
    expect(migration.match(/destination_type in \(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("push_subscriptions endpoint is globally unique (not per-user) so account switch on one device reassigns ownership", () => {
    expect(migration).toContain(
      "create unique index if not exists push_subscriptions_endpoint_key\n  on public.push_subscriptions (endpoint);",
    );
  });

  it("push_subscriptions has no direct write policy - only SELECT, mutation goes through RPCs", () => {
    const tableSection = migration.split("-- 3. notification_campaigns")[0] ?? "";
    expect(tableSection).toContain('"Users can read own push subscriptions"');
    expect(tableSection).not.toMatch(/create policy[^;]*push_subscriptions[^;]*for insert/i);
    expect(tableSection).not.toMatch(/create policy[^;]*push_subscriptions[^;]*for update/i);
  });

  it("notification_campaigns requires at least one channel and constrains status/audience/source to known values", () => {
    expect(migration).toContain(
      "constraint notification_campaigns_channel_check check (\n    channel_internal or channel_push\n  )",
    );
    expect(migration).toContain(
      "'draft', 'scheduled', 'processing', 'sent', 'partially_failed',\n      'failed', 'cancelled'",
    );
    expect(migration).toContain(
      "constraint notification_campaigns_source_check check (\n    source in ('admin', 'automation')\n  )",
    );
  });

  it("notification_deliveries is idempotent per campaign+user and has a retry index", () => {
    expect(migration).toContain(
      "create unique index if not exists notification_deliveries_campaign_user_key\n  on public.notification_deliveries (campaign_id, user_id);",
    );
    expect(migration).toContain(
      "create index if not exists notification_deliveries_retry_idx\n  on public.notification_deliveries (next_retry_at) where status = 'failed';",
    );
  });

  it("every new RPC is security definer with a locked-down search_path", () => {
    const rpcNames = [
      "mark_notification_read",
      "mark_all_notifications_read",
      "mark_notification_opened",
      "mark_notification_clicked",
      "upsert_push_subscription",
      "revoke_push_subscription",
    ];
    for (const name of rpcNames) {
      const start = migration.indexOf(`create or replace function public.${name}`);
      expect(start, `expected to find ${name}`).toBeGreaterThan(-1);
      const nextFn = migration.indexOf("create or replace function", start + 10);
      const body = migration.slice(start, nextFn === -1 ? undefined : nextFn);
      expect(body, `${name} missing security definer`).toContain("security definer");
      expect(body, `${name} missing locked search_path`).toContain("set search_path = public, pg_temp");
    }
  });

  it("every RPC requires an authenticated session before mutating", () => {
    const mutationRpcs = [
      "mark_notification_read",
      "mark_all_notifications_read",
      "mark_notification_opened",
      "mark_notification_clicked",
      "upsert_push_subscription",
      "revoke_push_subscription",
    ];
    for (const name of mutationRpcs) {
      const start = migration.indexOf(`create or replace function public.${name}`);
      const nextFn = migration.indexOf("create or replace function", start + 10);
      const body = migration.slice(start, nextFn === -1 ? undefined : nextFn);
      expect(body, `${name} missing session guard`).toContain("if actor_id is null then");
    }
  });

  it("revokes public/anon execute and grants only to authenticated for every new RPC", () => {
    expect(migration).toContain(
      "revoke all on function public.mark_notification_read(uuid) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.mark_notification_read(uuid) to authenticated;",
    );
    expect(migration).toContain(
      "revoke all on function public.upsert_push_subscription(text, text, text, text, text, text) from public, anon;",
    );
  });

  it("upsert_push_subscription reassociates ownership and clears revoked_at on conflict, closing the account-switch gap", () => {
    const start = migration.indexOf("create or replace function public.upsert_push_subscription");
    const end = migration.indexOf("create or replace function public.revoke_push_subscription");
    const body = migration.slice(start, end);
    expect(body).toContain("on conflict (endpoint) do update");
    expect(body).toContain("user_id = excluded.user_id");
    expect(body).toContain("revoked_at = null");
  });

  it("comment on push_subscriptions documents that p256dh/auth are backend-only", () => {
    expect(migration).toContain("p256dh/auth nunca devem");
  });
});
