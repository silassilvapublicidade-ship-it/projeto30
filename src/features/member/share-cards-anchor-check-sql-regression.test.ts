import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0018_share_cards_anchor_check_strict.sql"),
    "utf8",
  );
}

describe("share_cards anchor check strictness SQL migration", () => {
  const migration = readMigration();

  it("only redefines the anchor check constraint, nothing else", () => {
    expect(migration).toContain("drop constraint if exists share_cards_anchor_check");
    expect(migration).toContain("add constraint share_cards_anchor_check");
    expect(migration).not.toContain("create table");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("delete from");
  });

  it("requires progress cards to have both other anchors null", () => {
    const constraintBlock = migration
      .split("add constraint share_cards_anchor_check")[1]
      ?.split(");")[0];
    expect(constraintBlock).toContain("card_type = 'progress'");
    expect(constraintBlock).toContain("daily_log_id is not null");
    expect(constraintBlock).toContain("achievement_id is null");
    expect(constraintBlock).toContain("user_achievement_id is null");
  });

  it("requires achievement cards to have achievement_id AND user_achievement_id, and no daily_log_id", () => {
    const constraintBlock = migration
      .split("add constraint share_cards_anchor_check")[1]
      ?.split(");")[0];
    expect(constraintBlock).toContain("card_type = 'achievement'");
    expect(constraintBlock).toContain("user_achievement_id is not null");
    expect(constraintBlock).toContain("achievement_id is not null");
    expect(constraintBlock).toContain("daily_log_id is null");
  });
});
