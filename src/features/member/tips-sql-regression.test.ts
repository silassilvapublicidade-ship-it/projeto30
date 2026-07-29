import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", "0011_tips_content.sql"), "utf8");
}

describe("tips content SQL migration", () => {
  const migration = readMigration();

  it("reuses public.content_items instead of creating a parallel table", () => {
    expect(migration).not.toMatch(/create table (if not exists )?public\.tips/i);
    expect(migration).not.toMatch(/create table (if not exists )?public\.dicas/i);
    expect(migration).toContain("alter table public.content_items");
  });

  it("only adds the two missing columns, both safe/additive", () => {
    expect(migration).toContain("add column if not exists category text");
    expect(migration).toContain(
      "add column if not exists display_order integer not null default 0",
    );
  });

  it("never drops or alters existing columns", () => {
    expect(migration).not.toContain("drop column");
    expect(migration).not.toContain("alter column");
  });

  it("tightens read access to authenticated users only, without touching admin write access", () => {
    expect(migration).toContain(
      'drop policy if exists "Anyone can read published content" on public.content_items;',
    );
    expect(migration).toContain(
      'create policy "Authenticated users can read published content"',
    );
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("using (status = 'published')");
    expect(migration).not.toContain('drop policy if exists "Admins can manage content"');
  });

  it("never deletes rows or other tables", () => {
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("drop table");
  });
});
