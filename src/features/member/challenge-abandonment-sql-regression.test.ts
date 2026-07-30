import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(fileName: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", fileName), "utf8");
}

describe("challenge abandonment (migration 0021)", () => {
  const migration = readMigration("0021_challenge_abandonment.sql");

  it("adds a nullable abandoned_at column, never dropping or renaming existing ones", () => {
    expect(migration).toContain("add column if not exists abandoned_at timestamptz;");
  });

  it("abandon_challenge_enrollment validates ownership via auth.uid(), never trusting a client-supplied user_id", () => {
    const fnStart = migration.indexOf("create or replace function public.abandon_challenge_enrollment");
    const fnBody = migration.slice(fnStart, fnStart + 1600);
    expect(fnBody).toContain("actor_id uuid := auth.uid();");
    expect(fnBody).toContain("and user_id = actor_id");
    expect(fnBody).not.toMatch(/target_user_id/);
  });

  it("locks the row (for update) before transitioning, to avoid a concurrent double-abandon race", () => {
    const fnStart = migration.indexOf("create or replace function public.abandon_challenge_enrollment");
    const fnBody = migration.slice(fnStart, fnStart + 1600);
    expect(fnBody).toContain("for update;");
  });

  it("only accepts active/paused as the source status, rejecting completed/other with 22023", () => {
    expect(migration).toContain("if enrollment_record.status not in ('active', 'paused') then");
    expect(migration).toContain("errcode = '22023'");
  });

  it("is idempotent: re-abandoning an already-abandoned enrollment returns already_abandoned=true instead of erroring", () => {
    expect(migration).toContain("if enrollment_record.status = 'abandoned'::public.enrollment_status then");
    expect(migration).toContain("'already_abandoned', true");
  });

  it("never deletes any historical data - no DELETE statements anywhere in the migration", () => {
    expect(migration.toLowerCase()).not.toMatch(/\bdelete\s+from\b/);
  });

  it("records challenge_abandoned via the existing idempotent record_analytics_event plumbing", () => {
    expect(migration).toContain("'challenge_abandoned', enrollment_record.challenge_id, enrollment_record.id");
  });

  it("blocks re-enrollment into a challenge the user already abandoned, with a distinct error code", () => {
    expect(migration).toContain("previously_abandoned");
    expect(migration).toContain("errcode = 'P0006'");
  });

  it("excludes abandoned challenges from join_available_challenge's automatic candidate pool", () => {
    const fnStart = migration.indexOf("create or replace function public.join_available_challenge");
    const fnBody = migration.slice(fnStart, migration.indexOf("$$;", fnStart));
    expect(fnBody).toContain("ce.status in ('active', 'paused', 'abandoned')");
  });

  it("grants execute only to authenticated, never anon/public", () => {
    expect(migration).toContain(
      "grant execute on function public.abandon_challenge_enrollment(uuid) to authenticated;",
    );
    expect(migration).toContain(
      "revoke all on function public.abandon_challenge_enrollment(uuid) from public, anon;",
    );
  });
});
