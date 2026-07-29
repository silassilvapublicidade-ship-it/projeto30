import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", "0012_achievement_sharing.sql"), "utf8");
}

describe("achievement sharing SQL migration", () => {
  const migration = readMigration();

  it("only adds nullable/safe columns to achievements, no new table", () => {
    expect(migration).not.toMatch(/create table/i);
    expect(migration).toContain("alter table public.achievements");
    expect(migration).toContain("add column if not exists category text");
    expect(migration).toContain("add column if not exists rarity text");
    expect(migration).toContain("add column if not exists share_title text");
    expect(migration).toContain("add column if not exists share_message text");
  });

  it("never drops or renames existing columns", () => {
    expect(migration).not.toContain("drop column");
    expect(migration).not.toContain("rename column");
  });

  it("documents reusing share_templates/share_cards instead of a parallel structure", () => {
    expect(migration).toMatch(/share_templates/);
    expect(migration).toMatch(/share_cards/);
    expect(migration).toMatch(/NAO devem ser duplicadas por uma tabela nova/);
  });

  it("never touches finalize_daily_log, points, or streak", () => {
    expect(migration).not.toContain("create or replace function public.finalize_daily_log");
    expect(migration).not.toContain("set streak_current");
    expect(migration).not.toContain("insert into public.point_events");
  });

  it("never deletes rows", () => {
    expect(migration).not.toContain("delete from");
  });
});
