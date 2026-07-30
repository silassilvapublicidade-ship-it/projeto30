import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", "0023_tip_cards.sql"), "utf8");
}

describe("tip cards SQL migration", () => {
  const migration = readMigration();

  it("reuses public.content_items instead of creating a parallel table for images", () => {
    expect(migration).not.toMatch(/create table (if not exists )?public\.tip_cards/i);
    expect(migration).toContain("alter table public.content_items");
  });

  it("only adds the three missing columns, all additive", () => {
    expect(migration).toContain("add column if not exists alt_text text");
    expect(migration).toContain("add column if not exists starts_at timestamptz");
    expect(migration).toContain("add column if not exists ends_at timestamptz");
  });

  it("never drops or alters existing columns, never touches RLS policies already covering content_items", () => {
    expect(migration).not.toContain("drop column");
    expect(migration).not.toContain("alter column");
    expect(migration).not.toContain("drop policy");
  });

  it("creates a dedicated tip-cards bucket, not reusing avatars or challenge-covers", () => {
    expect(migration).toContain("insert into storage.buckets (id, name, public)");
    expect(migration).toContain("values ('tip-cards', 'tip-cards', true)");
  });

  it("makes the bucket publicly readable", () => {
    expect(migration).toContain('using (bucket_id = \'tip-cards\');');
  });

  it("scopes storage write policy to public.is_admin(), same as challenge-covers", () => {
    expect(migration).toContain("bucket_id = 'tip-cards' and public.is_admin()");
  });

  it("never deletes rows or other tables", () => {
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("drop table");
  });
});
