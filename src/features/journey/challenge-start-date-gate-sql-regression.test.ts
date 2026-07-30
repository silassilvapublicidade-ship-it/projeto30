import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration(fileName: string) {
  return readFileSync(join(process.cwd(), "supabase", "migrations", fileName), "utf8");
}

describe("challenge start_date execution gate (migration 0019)", () => {
  const migration = readMigration("0019_challenge_start_date_gate.sql");

  it("redefines ensure_today_daily_log (the only function that creates daily_logs)", () => {
    expect(migration).toContain(
      "create or replace function public.ensure_today_daily_log(",
    );
  });

  it("selects challenges.start_date so it can be checked", () => {
    expect(migration).toContain("c.start_date, u.timezone");
  });

  it("rejects opening a day before the challenge's official start_date with a distinct error code", () => {
    expect(migration).toMatch(
      /if enrollment_record\.start_date is not null and local_date < enrollment_record\.start_date then/,
    );
    expect(migration).toContain("errcode = 'P0005'");
  });

  it("checks start_date before computing the personal day number", () => {
    const startDateCheckIndex = migration.indexOf("errcode = 'P0005'");
    const calculatedDayIndex = migration.indexOf("calculated_day := public.journey_calculate_day(");

    expect(startDateCheckIndex).toBeGreaterThan(-1);
    expect(calculatedDayIndex).toBeGreaterThan(-1);
    expect(startDateCheckIndex).toBeLessThan(calculatedDayIndex);
  });

  it("does not touch join_specific_challenge/join_available_challenge (early enrollment stays allowed)", () => {
    expect(migration).not.toContain("create or replace function public.join_specific_challenge");
    expect(migration).not.toContain("create or replace function public.join_available_challenge");
  });
});
