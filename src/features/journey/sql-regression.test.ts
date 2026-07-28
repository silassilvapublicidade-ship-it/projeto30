import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
});
