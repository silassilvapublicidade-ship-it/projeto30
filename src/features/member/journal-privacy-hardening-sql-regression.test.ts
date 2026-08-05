import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");
}

const privacyMigration = readMigration("0081_journal_privacy_hardening.sql");
const historyMigration = readMigration("0082_member_journal_history.sql");

describe("0081 - journal_entries RLS no longer has an admin exception", () => {
  it("drops the old policies that let ANY admin read/write journal content directly", () => {
    expect(privacyMigration).toContain('drop policy if exists "Users can read own journal entries" on public.journal_entries;');
    expect(privacyMigration).toContain('drop policy if exists "Admins can manage journal entries" on public.journal_entries;');
  });

  it("the new select policy is owner-only, no is_admin() clause", () => {
    const policyBlock = privacyMigration.match(/create policy "Users can read own journal entries"[\s\S]*?;/)?.[0] ?? "";
    expect(policyBlock).toContain("using (user_id = auth.uid())");
    expect(policyBlock).not.toContain("is_admin()");
  });

  it("defines no write policy at all - writes stay exclusive to save_journal_entry (security definer, unchanged)", () => {
    expect(privacyMigration).not.toMatch(/create policy[\s\S]{0,40}journal_entries[\s\S]{0,40}for (insert|update|delete|all)/);
  });
});

describe("0081 - admin_participant_detail redacts journal content for every admin", () => {
  const fn = privacyMigration.split("function public.admin_participant_detail")[1]?.split("$$;")[0] ?? "";

  it("never selects content/gratitude/difficulty/victory/tomorrow_focus/mood as values - only their lengths", () => {
    expect(fn).not.toMatch(/select[\s\S]{0,80}je\.content,/);
    expect(fn).toContain("length(je.content)");
    expect(fn).toContain("has_content");
    expect(fn).toContain("character_count");
  });

  it("reflections_visible is unconditionally true now - it's metadata, not a super_admin secret anymore", () => {
    expect(fn).toContain("'reflections_visible', true");
  });

  it("still requires an admin session (perform admin_require_admin())", () => {
    expect(fn).toContain("perform public.admin_require_admin();");
  });
});

describe("0082 - member_list_journal_entries is scoped to the caller only", () => {
  const fn = historyMigration.split("function public.member_list_journal_entries")[1]?.split("$$;")[0] ?? "";

  it("requires auth.uid() and filters every query by je.user_id = v_user_id - never a client-supplied user id", () => {
    expect(fn).toContain("if v_user_id is null then");
    expect(fn).toContain("where je.user_id = v_user_id");
  });

  it("is paginated with a hard cap - never loads the whole history at once", () => {
    expect(fn).toContain("greatest(least(coalesce(p_limit, 20), 50), 1)");
  });

  it("orders most-recent-first", () => {
    expect(fn).toContain("order by dl.log_date desc");
  });
});
