import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", "0015_analytics_events.sql"), "utf8");
}

describe("analytics_events SQL migration", () => {
  const migration = readMigration();

  it("creates a genuinely new table (nothing equivalent existed before)", () => {
    expect(migration).toContain("create table if not exists public.analytics_events");
  });

  it("never stores email, journal content or free text from the user", () => {
    expect(migration).not.toContain("email");
    expect(migration).not.toContain("journal_entries");
    expect(migration).not.toContain("content text");
  });

  it("restricts event_name to a closed, documented list via check constraint", () => {
    expect(migration).toContain("analytics_events_event_name_check");
    for (const eventName of [
      "challenge_catalog_viewed",
      "challenge_detail_viewed",
      "challenge_join_clicked",
      "challenge_joined",
      "challenge_first_habit_completed",
      "challenge_day_completed",
      "challenge_day_7_reached",
      "challenge_halfway_reached",
      "challenge_completed",
      "challenge_abandoned",
      "share_achievement_started",
      "share_achievement_completed",
    ]) {
      expect(migration).toContain(`'${eventName}'`);
    }
  });

  it("indexes every column used for filtering by the admin funnel", () => {
    expect(migration).toContain("analytics_events_challenge_idx");
    expect(migration).toContain("analytics_events_enrollment_idx");
    expect(migration).toContain("analytics_events_event_name_idx");
    expect(migration).toContain("analytics_events_occurred_at_idx");
    expect(migration).toContain("analytics_events_user_idx");
  });

  it("enforces idempotency of milestone events via a partial unique index", () => {
    expect(migration).toContain("analytics_events_enrollment_milestone_unique");
    expect(migration).toContain("where enrollment_id is not null");
  });

  it("enables RLS and restricts select to admins only, with no client insert policy", () => {
    expect(migration).toContain("alter table public.analytics_events enable row level security");
    expect(migration).toContain("Admins can read analytics events");
    expect(migration).toContain("using (public.is_admin())");
    expect(migration).not.toMatch(/create policy[^;]*analytics_events[^;]*for insert/i);
  });

  it("the write RPC validates event name, source, metadata shape/size, enrollment ownership and challenge existence", () => {
    expect(migration).toContain("create or replace function public.record_analytics_event");
    expect(migration).toContain("Nome de evento nao permitido");
    expect(migration).toContain("Origem de evento invalida");
    expect(migration).toContain("jsonb_typeof(normalized_metadata) <> 'object'");
    expect(migration).toContain("octet_length(normalized_metadata::text) > 2000");
    expect(migration).toContain("Inscricao informada nao pertence ao usuario atual");
    expect(migration).toContain("Desafio informado nao existe");
  });

  it("grants execute only to authenticated, revoking public/anon", () => {
    expect(migration).toMatch(/revoke execute on function public\.record_analytics_event[\s\S]*?from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.record_analytics_event[\s\S]*?to authenticated/);
  });

  it("never deletes rows or drops tables", () => {
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("drop table");
  });
});
