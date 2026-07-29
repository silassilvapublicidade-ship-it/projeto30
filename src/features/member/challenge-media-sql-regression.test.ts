import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(
      process.cwd(),
      "supabase",
      "migrations",
      "0009_habit_frequency_and_challenge_media.sql",
    ),
    "utf8",
  );
}

describe("habit frequency and challenge media SQL migration", () => {
  const migration = readMigration();

  it("adds read policies for habits without touching write policies or other tables", () => {
    expect(migration).toContain(
      'create policy "Authenticated users can read habits of ended challenges"',
    );
    expect(migration).toContain(
      'create policy "Users can read habits of challenges they are enrolled in"',
    );
    expect(migration).toContain("on public.habits for select");
    expect(migration).not.toContain("on public.habits for all");
    expect(migration).not.toContain("on public.habits for insert");
    expect(migration).not.toContain("on public.habits for update");
    expect(migration).not.toContain("on public.habits for delete");
  });

  it("scopes the ended-habits policy to ended, non-deleted challenges only", () => {
    expect(migration).toContain("c.status = 'ended'");
    expect(migration).toContain("c.deleted_at is null");
  });

  it("scopes the enrolled-habits policy to the requesting user's own enrollments", () => {
    expect(migration).toContain("ce.user_id = auth.uid()");
  });

  it("adds cover_image_url as a nullable generic column, not a new narrow field", () => {
    expect(migration).toContain(
      "alter table public.challenges\n  add column if not exists cover_image_url text;",
    );
    expect(migration).not.toContain("cover_image_base64");
    expect(migration).not.toContain("data:image");
  });

  it("creates a dedicated challenge-covers bucket instead of reusing avatars", () => {
    expect(migration).toContain("values ('challenge-covers', 'challenge-covers', true)");
    expect(migration).not.toContain("'avatars'");
  });

  it("makes challenge covers publicly readable but restricts writes to admins", () => {
    expect(migration).toContain('create policy "Challenge covers are publicly readable"');
    expect(migration).toContain("on storage.objects for select");
    expect(migration).toContain('create policy "Admins can manage challenge covers"');
    expect(migration).toContain("on storage.objects for all");
    expect(migration).toContain("public.is_admin()");
  });

  it("adds habit_frequency_type as a safe, additive enum creation", () => {
    expect(migration).toContain("create type public.habit_frequency_type as enum");
    expect(migration).toContain("'daily'");
    expect(migration).toContain("'weekly'");
    expect(migration).toContain("'monthly'");
    expect(migration).toContain("exception when duplicate_object then null;");
  });

  it("adds frequency_type to habits with a safe default of daily (backwards compatible)", () => {
    expect(migration).toContain(
      "add column if not exists frequency_type public.habit_frequency_type not null default 'daily';",
    );
  });

  it("redefines journey_recalculate_daily_log to only count daily habits toward completion", () => {
    expect(migration).toContain(
      "create or replace function public.journey_recalculate_daily_log(",
    );
    expect(migration).toContain("and h.frequency_type = 'daily';");
    // Guards against reintroducing the ambiguous self-reference bug fixed in 0003.
    expect(migration).not.toContain(
      "journey_recalculate_daily_log.completion_percent",
    );
    expect(migration).toContain("computed_completion_percent");
  });

  it("keeps journey_recalculate_daily_log security definer with execute revoked from public roles", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "revoke execute on function public.journey_recalculate_daily_log(uuid)\n  from public, anon, authenticated;",
    );
  });

  it("never touches point_events, streak columns or join_specific_challenge", () => {
    expect(migration).not.toContain("insert into public.point_events");
    expect(migration).not.toContain("update public.point_events");
    expect(migration).not.toContain("set streak_current");
    // join_specific_challenge may be mentioned in a doc comment (unaffected
    // by this migration), but must not be redefined here.
    expect(migration).not.toContain(
      "create or replace function public.join_specific_challenge",
    );
  });
});
