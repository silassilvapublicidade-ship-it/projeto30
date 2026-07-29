import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function stripSqlComments(source: string) {
  return source
    .split("\n")
    .map((line) => {
      const commentIndex = line.indexOf("--");
      return commentIndex === -1 ? line : line.slice(0, commentIndex);
    })
    .join("\n");
}

describe("daily journey SQL regressions", () => {
  it("does not reference the recalculate function name as a row alias", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "0003_fix_daily_log_recalculate.sql",
      ),
      "utf8",
    );

    expect(migration).not.toContain(
      "journey_recalculate_daily_log.completion_percent",
    );
    expect(migration).toContain(
      "set completion_percent = computed_completion_percent",
    );
  });

  it("does not reference finalize_daily_log as a row alias and blocks incomplete required habits", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "0004_fix_finalize_daily_log.sql"),
      "utf8",
    );
    const activeSql = stripSqlComments(migration);

    expect(activeSql).not.toContain("finalize_daily_log.points_earned");
    expect(activeSql).toContain("set points_earned = v_points_earned");
    expect(activeSql).toContain("errcode = 'P0003'");
    expect(activeSql).toMatch(/cdh\.required[\s\S]*?<>\s*'completed'/);
  });

  it("qualifies the streak lookback query so completion_percent is not ambiguous", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "0005_fix_finalize_daily_log_streak_query.sql",
      ),
      "utf8",
    );
    const activeSql = stripSqlComments(migration);

    expect(activeSql).not.toMatch(/select log_date, completion_percent\s*\n\s*from/);
    expect(activeSql).toContain("select dl.log_date, dl.completion_percent");
    expect(activeSql).toContain("from public.daily_logs dl");
  });
});
