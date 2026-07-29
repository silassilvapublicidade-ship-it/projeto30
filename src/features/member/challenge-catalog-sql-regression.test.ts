import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0008_challenge_catalog.sql"),
    "utf8",
  );
}

describe("challenge catalog SQL migration", () => {
  const migration = readMigration();

  it("defines join_specific_challenge as security definer", () => {
    expect(migration).toContain(
      "create or replace function public.join_specific_challenge(",
    );
    expect(migration).toContain("security definer");
  });

  it("requires an authenticated session before doing anything else", () => {
    expect(migration).toContain("if actor_id is null then");
    expect(migration).toContain("errcode = '42501'");
  });

  it("rejects joining a second challenge while one is already active, with a distinct error code", () => {
    expect(migration).toContain("Voce ja esta participando de outro desafio ativo.");
    expect(migration).toContain("errcode = 'P0004'");
  });

  it("is idempotent when re-joining the same challenge already enrolled in", () => {
    expect(migration).toContain("existing_enrollment.challenge_id = target_challenge_id");
    expect(migration).toContain("return existing_enrollment.id;");
  });

  it("only allows joining an active challenge within its enrollment window", () => {
    expect(migration).toContain("c.status = 'active'");
    expect(migration).toContain("c.enrollment_start is null or c.enrollment_start <= local_date");
    expect(migration).toContain("c.enrollment_end is null or c.enrollment_end >= local_date");
    expect(migration).toContain("errcode = 'P0002'");
  });

  it("relies on the existing one-active-enrollment-per-user unique index, not a new constraint", () => {
    expect(migration).not.toContain("create unique index");
    expect(migration).not.toContain("create constraint");
  });

  it("revokes execute from anon/public and grants only to authenticated", () => {
    expect(migration).toContain(
      "revoke execute on function public.join_specific_challenge(uuid)\n  from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.join_specific_challenge(uuid)\n  to authenticated;",
    );
  });

  it("adds read policies for challenges without touching write policies or other tables", () => {
    expect(migration).toContain(
      'create policy "Authenticated users can read ended challenges"',
    );
    expect(migration).toContain(
      'create policy "Users can read challenges they are enrolled in"',
    );
    expect(migration).toContain("on public.challenges for select");
    expect(migration).not.toContain("on public.challenges for all");
    expect(migration).not.toContain("on public.challenges for insert");
    expect(migration).not.toContain("on public.challenges for update");
    expect(migration).not.toContain("on public.challenges for delete");
  });

  it("never writes to scoring, streak, or finalization tables", () => {
    expect(migration).not.toContain("public.finalize_daily_log");
    expect(migration).not.toContain("insert into public.point_events");
    expect(migration).not.toContain("update public.point_events");
    expect(migration).not.toContain("update public.daily_logs");
    expect(migration).not.toContain("set streak_current");
    expect(migration).not.toContain("set completion_percent");
  });
});
