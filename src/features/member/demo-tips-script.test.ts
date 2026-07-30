import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts", "content", "create-demo-tips.sql");
const sql = readFileSync(scriptPath, "utf8");

function stripSqlComments(source: string) {
  return source
    .split("\n")
    .map((line) => {
      const commentIndex = line.indexOf("--");
      return commentIndex === -1 ? line : line.slice(0, commentIndex);
    })
    .join("\n");
}

const activeSql = stripSqlComments(sql).toLowerCase();

describe("demo tips administrative script", () => {
  it("is not a migration and is not wired into supabase/migrations", () => {
    expect(activeSql).not.toContain("supabase/migrations");
    expect(activeSql).not.toContain("supabase db push");
  });

  it("reuses public.content_items instead of a parallel table", () => {
    expect(activeSql).toContain("insert into public.content_items");
    expect(activeSql).not.toMatch(/create table/);
  });

  it("uses a UUID range distinct from the internal validation and august challenges", () => {
    expect(activeSql).toContain("a4000000-0000-4000-8000-");
    expect(activeSql).not.toContain("a2300000-0000-4000-8000-000000000001");
  });

  it("declares exactly 6 minimal demo tips, not mass content", () => {
    const rowMatches = sql.match(/^\s*\(\d,\n\s*'[^']+',/gm);
    expect(rowMatches).toHaveLength(6);
  });

  it("links some tips to the august challenge and keeps some general", () => {
    const augustLinked = (
      activeSql.match(/'a3080000-0000-4000-8000-000000000001'::uuid,/g) ?? []
    ).length;
    // Appears once in the values() column list and once per linked tip row.
    expect(augustLinked).toBeGreaterThanOrEqual(4);
    expect(activeSql).toContain("null,\n      60)");
  });

  it("is idempotent via a fixed id + on conflict do update, never duplicate-inserting", () => {
    expect(activeSql).toContain("on conflict (id) do update set");
  });

  it("inserts as draft, never published, since these rows never have a real image_url", () => {
    expect(activeSql).toContain("'draft',");
    expect(activeSql).not.toContain("'published',");
  });

  it("never deletes rows or creates users", () => {
    expect(activeSql).not.toContain("delete from");
    expect(activeSql).not.toContain("insert into auth.users");
  });

  it("self-validates row count and absence of duplicate slugs before committing", () => {
    expect(activeSql).toContain("esperado 6 dicas de demonstracao");
    expect(activeSql).toContain("slugs de dica duplicados");
  });
});
