import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0033_admin_achievements_crud.sql"),
    "utf8",
  );
}

describe("admin achievements CRUD SQL migration", () => {
  const migration = readMigration();

  it("defines both functions as security definer, gated by admin_require_admin", () => {
    for (const name of ["admin_achievement_delete_preview", "admin_delete_achievement"]) {
      const body = migration.split(`function public.${name}(`)[1]?.split("$$;")[0];
      expect(body, `${name} should exist`).toBeDefined();
      expect(body).toContain("security definer");
      expect(body).toContain("perform public.admin_require_admin();");
    }
  });

  it("computes can_delete from the real count of user_achievements, not a client-supplied flag", () => {
    const previewBody = migration
      .split("function public.admin_achievement_delete_preview(")[1]
      ?.split("$$;")[0];
    expect(previewBody).toContain("from public.user_achievements");
    expect(previewBody).toContain("'can_delete', v_unlocked_count = 0");
  });

  it("admin_delete_achievement re-checks unlocked_count = 0 itself, never trusting a prior preview call", () => {
    const deleteBody = migration.split("function public.admin_delete_achievement(")[1]?.split("$$;")[0];
    expect(deleteBody).toBeDefined();
    expect(deleteBody).toContain("from public.user_achievements");
    expect(deleteBody).toContain("if v_unlocked_count > 0 then");
    expect(deleteBody).toContain("using errcode = 'P0003';");
  });

  it("delete has no bypass path (no confirmation-phrase parameter, unlike the test-challenge purge)", () => {
    expect(migration).not.toContain("confirmation_phrase");
    expect(migration).not.toContain("confirmation_name");
  });

  it("only ever deletes from achievements, never from user_achievements or share_cards directly", () => {
    expect(migration).toContain("delete from public.achievements");
    expect(migration).not.toContain("delete from public.user_achievements");
    expect(migration).not.toContain("delete from public.share_cards");
  });

  it("revokes and grants execute for both functions", () => {
    for (const signature of ["admin_achievement_delete_preview(uuid)", "admin_delete_achievement(uuid)"]) {
      expect(migration).toContain(
        `revoke execute on function public.${signature}\n  from public, anon, authenticated;`,
      );
      expect(migration).toContain(`grant execute on function public.${signature}\n  to authenticated;`);
    }
  });

  it("never touches point calculation, streak formula or the unlock engine itself", () => {
    expect(migration).not.toContain("insert into public.point_events");
    expect(migration).not.toContain("streak_current");
    expect(migration).not.toContain("create or replace function public.finalize_daily_log");
    expect(migration).not.toContain("insert into public.user_achievements");
  });
});
