import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(fileName: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", fileName), "utf8");
}

describe("admin_normalize_early_enrollment (migration 0020)", () => {
  const migration = readMigration("0020_admin_normalize_early_enrollment.sql");

  it("requires an admin before normalizing anything", () => {
    expect(migration).toContain("perform public.admin_require_admin();");
  });

  it("is idempotent: a no-op when personal_start_date already matches or is after start_date", () => {
    expect(migration).toContain(
      "if v_enrollment.start_date is null or v_enrollment.personal_start_date >= v_enrollment.start_date then",
    );
    expect(migration).toContain("'reason', 'already_aligned'");
  });

  it("only removes daily_logs strictly before the challenge's start_date, never the enrollment itself", () => {
    expect(migration).toContain("and log_date < v_enrollment.start_date");
    expect(migration).not.toMatch(/delete from public\.challenge_enrollments/);
  });

  it("only removes achievements tied to the specific early daily_logs being removed, never a blanket delete", () => {
    expect(migration).toContain("(metadata ->> 'daily_log_id')::uuid = any (v_early_log_ids)");
  });

  it("clamps personal_start_date to the challenge's own start_date and resets current_day to the pre-cycle baseline", () => {
    expect(migration).toContain("personal_start_date = v_enrollment.start_date");
    expect(migration).toContain("current_day = 1");
  });

  it("is scoped to a single enrollment_id argument, never operates in bulk", () => {
    expect(migration).toContain("p_enrollment_id uuid");
    expect(migration).not.toMatch(/for\s+.*\s+in\s+select.*challenge_enrollments/i);
  });

  it("grants execute only to authenticated (admin check happens inside the function body)", () => {
    expect(migration).toContain(
      "grant execute on function public.admin_normalize_early_enrollment(uuid) to authenticated;",
    );
  });
});
