import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0031_analytics_tips_events.sql"),
    "utf8",
  );
}

describe("analytics tips events SQL migration", () => {
  const migration = readMigration();

  it("adds content_item_id as a nullable FK, never backfilling or deleting existing rows", () => {
    expect(migration).toContain(
      "add column if not exists content_item_id uuid references public.content_items(id) on delete set null",
    );
    expect(migration).not.toContain("update public.analytics_events");
    expect(migration).not.toContain("delete from");
  });

  it("indexes content_item_id for the admin tips analytics lookups", () => {
    expect(migration).toContain("analytics_events_content_item_idx");
  });

  it("drops the old 6-arg record_analytics_event before redefining it with 7 args", () => {
    expect(migration).toContain(
      "drop function if exists public.record_analytics_event(text, uuid, uuid, jsonb, text, text);",
    );
    expect(migration).toContain("create or replace function public.record_analytics_event(");
    expect(migration).toContain("p_content_item_id uuid default null");
  });

  it("extends both the table check constraint and the function's internal whitelist with the 3 new tip events", () => {
    for (const eventName of ["tip_card_viewed", "tip_card_opened", "tip_card_downloaded"]) {
      const constraintMatches = migration.match(new RegExp(`'${eventName}'`, "g")) ?? [];
      // At least once in the ALTER ... CHECK constraint and once in the
      // function's own validation list - never one without the other.
      expect(constraintMatches.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("re-applies revoke/grant for the new 7-arg signature (Postgres defaults fresh functions to PUBLIC execute)", () => {
    expect(migration).toMatch(
      /revoke all on function public\.record_analytics_event\(text, uuid, uuid, jsonb, text, text, uuid\)\s*from public, anon;/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.record_analytics_event\(text, uuid, uuid, jsonb, text, text, uuid\)\s*to authenticated;/,
    );
  });

  it("never touches point calculation, streak formula or achievement unlock rules", () => {
    expect(migration).not.toContain("point_events");
    expect(migration).not.toContain("streak_current");
    expect(migration).not.toContain("user_achievements");
  });
});
