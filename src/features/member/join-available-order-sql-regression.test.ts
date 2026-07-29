import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0013_join_available_challenge_deterministic_order.sql"),
    "utf8",
  );
}

function stripSqlComments(source: string) {
  return source
    .split("\n")
    .map((line) => {
      const commentIndex = line.indexOf("--");
      return commentIndex === -1 ? line : line.slice(0, commentIndex);
    })
    .join("\n");
}

describe("join_available_challenge deterministic order SQL migration", () => {
  const migration = readMigration();

  it("redefines only join_available_challenge, nothing else", () => {
    expect(migration).toContain("create or replace function public.join_available_challenge()");
    expect(migration).not.toContain("create or replace function public.join_specific_challenge");
    expect(migration).not.toContain("create unique index");
    expect(migration).not.toContain("drop index");
  });

  it("orders by start_date, then created_at, then id - all deterministic tiebreakers", () => {
    expect(migration).toContain(
      "order by c.start_date asc nulls last, c.created_at asc, c.id asc",
    );
  });

  it("does not invent a priority/display_order column", () => {
    const activeSql = stripSqlComments(migration);
    expect(activeSql).not.toContain("display_order");
    expect(activeSql).not.toContain("priority");
    expect(activeSql).not.toContain("add column");
  });

  it("keeps the not-exists per-challenge check and the same error codes", () => {
    expect(migration).toMatch(
      /not exists\s*\(\s*select 1\s*from public\.challenge_enrollments ce\s*where ce\.user_id = actor_id\s*and ce\.challenge_id = c\.id\s*and ce\.status in \('active', 'paused'\)\s*\)/,
    );
    expect(migration).toContain("errcode = 'P0002'");
    expect(migration).toContain("errcode = '42501'");
    expect(migration).toContain("errcode = '23505'");
  });

  it("never touches points, streak, finalization or the enrollment index", () => {
    expect(migration).not.toContain("insert into public.point_events");
    expect(migration).not.toContain("set streak_current");
    expect(migration).not.toContain("finalize_daily_log");
  });
});
