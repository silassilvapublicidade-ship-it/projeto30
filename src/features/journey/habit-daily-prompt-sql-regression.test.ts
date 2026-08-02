import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0036_habit_daily_prompts_and_finalize_gate_fix.sql"),
    "utf8",
  );
}

function sliceFunction(source: string, name: string, nextMarker: string) {
  const start = source.indexOf(name);
  expect(start, `expected to find "${name}"`).toBeGreaterThan(-1);
  const end = source.indexOf(nextMarker, start);
  expect(end, `expected to find "${nextMarker}" after "${name}"`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("Migration 0036 - daily_prompt column", () => {
  const migration = readMigration();

  it("adds a nullable column, never forcing a default that could hide missing content", () => {
    expect(migration).toContain("add column if not exists daily_prompt text;");
    expect(migration).not.toContain("daily_prompt text not null");
  });

  it("sets daily_prompt for all 13 real habits by exact id, never a blanket UPDATE", () => {
    const habitIds = [
      "a3080000-0000-4000-8002-000000000001",
      "a3080000-0000-4000-8002-000000000002",
      "a3080000-0000-4000-8002-000000000003",
      "a3080000-0000-4000-8002-000000000004",
      "a3080000-0000-4000-8002-000000000005",
      "a3080000-0000-4000-8002-000000000006",
      "a3080000-0000-4000-8002-000000000007",
      "a3080000-0000-4000-8002-000000000008",
      "a3080000-0000-4000-8002-000000000009",
      "a3080000-0000-4000-8002-000000000010",
      "a3080000-0000-4000-8002-000000000011",
      "a3080000-0000-4000-8002-000000000012",
      "a3080000-0000-4000-8002-000000000013",
    ];

    for (const id of habitIds) {
      expect(migration).toContain(`where id = '${id}';`);
    }
  });

  it("every daily_prompt set via UPDATE is phrased as a yes/no question ending in '?'", () => {
    // 12 standalone UPDATEs (habits 001-008, 010-013) + 1 combined UPDATE for
    // habit 009 (title/description/daily_prompt/validation_config together)
    // = 13. The 14th prompt (the new book-completion habit) is set inside
    // the INSERT's VALUES list, not this UPDATE syntax - checked separately
    // in the book-habit-split block below.
    const prompts = Array.from(migration.matchAll(/daily_prompt = '([^']+)'/g)).map((match) => match[1]);
    expect(prompts.length).toBe(13);

    for (const prompt of prompts) {
      expect(prompt?.trim().endsWith("?"), `"${prompt}" should end with "?"`).toBe(true);
    }
  });
});

describe("Migration 0036 - book habit split", () => {
  const migration = readMigration();

  it("repurposes the existing 'livro' habit into a daily reading check-in, never changing its id", () => {
    const updateBlock = sliceFunction(
      migration,
      "where id = 'a3080000-0000-4000-8002-000000000009';",
      "-- 4) Nova acao separada",
    );
    expect(migration).toContain("Ler um pouco do livro do mês");
    expect(migration).toContain("Leu um pouco do seu livro hoje?");
    expect(updateBlock.length).toBeGreaterThan(0);
  });

  it("removes the misleading target: 1 from the reading habit's validation_config (no fixed day-count goal)", () => {
    const updateBlock = sliceFunction(
      migration,
      "set\n  title = 'Ler um pouco do livro do mês'",
      "where id = 'a3080000-0000-4000-8002-000000000009';",
    );
    expect(updateBlock).not.toContain("'target'");
  });

  it("creates the book-completion habit as optional (required = false), not daily, worth 30 points", () => {
    const insertBlock = sliceFunction(
      migration,
      "insert into public.habits (",
      "on conflict (id) do nothing;",
    );
    expect(insertBlock).toContain("'a3080000-0000-4000-8002-000000000014'");
    expect(insertBlock).toContain("'Concluir o livro do mês'");
    expect(insertBlock).toContain("'Terminou o livro deste mês?'");
    expect(insertBlock).toContain("30,");
    expect(insertBlock).toContain("false,");
    expect(insertBlock).toContain("'monthly'");
  });

  it("links the new habit to every day of the real challenge (admin_generate_challenge_days can't run - challenge is already active, not draft)", () => {
    const linkBlock = sliceFunction(
      migration,
      "insert into public.challenge_day_habits (challenge_id, challenge_day_id, habit_id, sort_order, required)",
      "on conflict (challenge_day_id, habit_id) do nothing;",
    );
    expect(linkBlock).toContain("'a3080000-0000-4000-8002-000000000014'");
    expect(linkBlock).toContain("from public.challenge_days cd");
    expect(linkBlock).toContain("where cd.challenge_id = 'a3080000-0000-4000-8000-000000000001'");
  });
});

describe("Migration 0036 - finalize_daily_log required-habit gate fix", () => {
  const migration = readMigration();
  const body = sliceFunction(
    migration,
    "create or replace function public.finalize_daily_log",
    "$$;",
  );

  it("filters the missing_required_habits check to daily-frequency habits only", () => {
    const queryBlock = sliceFunction(
      body,
      "select count(*)\n  into missing_required_habits",
      "if missing_required_habits > 0 then",
    );
    expect(queryBlock).toContain("join public.habits h on h.id = cdh.habit_id");
    expect(queryBlock).toContain("and h.frequency_type = 'daily'::public.habit_frequency_type");
  });

  it("keeps the exact same error message and errcode for the gate", () => {
    expect(body).toContain("Habitos obrigatorios pendentes. Conclua todos antes de finalizar o dia.");
    expect(body).toContain("using errcode = 'P0003';");
  });

  it("never touches the points formula, streak formula, or achievement unlock conditions", () => {
    expect(body).toContain("streak_count := streak_count + 1;");
    expect(body).toContain("achievement_record.slug = 'tres-dias-seguidos' and streak_count >= 3");
    expect(body).toContain("all_habits_bonus_points");
    // The point-awarding loop and all_habits_bonus_points check are
    // untouched - they already derive from journey_recalculate_daily_log's
    // applicable_habits/completed_habits (already daily-only, see 0009),
    // so this fix doesn't change what "all habits completed" means.
    expect(body).toContain("applicable_habits > 0\n    and completed_habits = applicable_habits");
  });
});
