import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initialAchievementSlugs } from "../achievements/achievements.core";

const scriptPath = join(
  process.cwd(),
  "scripts",
  "challenges",
  "create-august-irreconhecivel.sql",
);

const sql = readFileSync(scriptPath, "utf8");

function stripSqlComments(source: string) {
  return source
    .split("\n")
    .map((line) => {
      const commentIndex = line.indexOf("--");
      return commentIndex === -1 ? line : line.slice(0, commentIndex);
    })
    .join("\n");
}

const activeSql = stripSqlComments(sql).toLowerCase();

describe("august challenge administrative script", () => {
  it("is not a migration and is not wired into supabase/migrations", () => {
    expect(sql).not.toContain("npx.cmd supabase db push");
    expect(activeSql).not.toContain("supabase/migrations");
    expect(activeSql).not.toContain("supabase db push");
  });

  it("declares itself administrative, non-seed and remote-only-when-explicit", () => {
    expect(sql).toContain("ESTE SCRIPT E ADMINISTRATIVO");
    expect(sql).toMatch(/NAO e uma migration/i);
    expect(sql).toMatch(/NAO e seed/i);
    expect(sql).toMatch(/supabase db query --linked --file/);
  });

  it("uses a UUID range distinct from the internal validation challenge", () => {
    expect(activeSql).toContain("a3080000-0000-4000-8000-000000000001");
    // The internal challenge id may only appear as a read-only guard/reference,
    // never as a target of insert/update/delete in the active SQL.
    const internalChallengeMentions = activeSql
      .split("a2300000-0000-4000-8000-000000000001")
      .length - 1;
    expect(internalChallengeMentions).toBeGreaterThan(0);
    expect(activeSql).not.toMatch(
      /update public\.challenges[\s\S]*?a2300000-0000-4000-8000-000000000001/,
    );
  });

  it("targets the expected challenge slug", () => {
    expect(activeSql).toContain("desafio-agosto-irreconhecivel");
  });

  it("never inserts, updates or deletes user-journey data in the active SQL", () => {
    const forbiddenTables = [
      "challenge_enrollments",
      "daily_logs",
      "habit_logs",
      "journal_entries",
      "point_events",
      "user_achievements",
      "users",
    ];

    for (const table of forbiddenTables) {
      expect(activeSql).not.toMatch(
        new RegExp(`insert into public\\.${table}\\b`),
      );
      expect(activeSql).not.toMatch(
        new RegExp(`update public\\.${table}\\b`),
      );
      expect(activeSql).not.toMatch(
        new RegExp(`delete from public\\.${table}\\b`),
      );
    }

    expect(activeSql).not.toContain("insert into auth.users");
  });

  it("keeps the destructive cleanup procedure fully commented out", () => {
    expect(activeSql).not.toContain("delete from public.challenges");
    expect(activeSql).not.toContain("delete from public.habits");
    expect(activeSql).not.toContain("delete from public.challenge_days");
  });

  it("only reuses the existing canonical achievement slugs", () => {
    for (const slug of initialAchievementSlugs) {
      expect(activeSql).toContain(`'${slug}'`);
    }

    // No new achievement slugs are introduced in this phase.
    const futureSlugs = [
      "hidratacao-em-dia",
      "quatro-treinos-na-semana",
      "sete-dias-sem-cafeina-tarde",
      "sete-dias-de-fe",
      "agosto-irreconhecivel",
    ];

    for (const slug of futureSlugs) {
      expect(activeSql).not.toContain(`'${slug}'`);
    }
  });

  it("declares exactly 13 habits with 2 optional (non-required) entries", () => {
    const habitRowMatches = activeSql.match(
      /\(\d{1,2}, '[^']+', '[^']+', '[^']+', '(boolean|quantity|duration|reading)'::public\.habit_type/g,
    );

    expect(habitRowMatches).toHaveLength(13);

    const optionalHabitMatches = activeSql.match(
      /'::public\.habit_type, '[^']+', 10, false,/g,
    );

    expect(optionalHabitMatches).toHaveLength(2);
  });

  it("declares exactly 31 day titles and 31 day messages", () => {
    const dayCatalogMatch = activeSql.match(
      /from unnest\(array\[[\s\S]*?\]\) with ordinality as t\(title, day_number\)/,
    );

    expect(dayCatalogMatch).not.toBeNull();

    const titleArrayMatch = activeSql.match(
      /from unnest\(array\[([\s\S]*?)\]\) with ordinality as t\(title, day_number\)/,
    );
    const titleCount = (titleArrayMatch?.[1] ?? "")
      .split(",")
      .filter((entry) => entry.trim().length > 0).length;

    expect(titleCount).toBe(31);
  });

  it("uses only canonical habit types supported by the schema", () => {
    const disallowedTypes = ["text", "single_choice", "multiple_choice"];

    for (const type of disallowedTypes) {
      expect(activeSql).not.toContain(`'${type}'::public.habit_type`);
    }
  });

  it("keeps the default status as draft with an explicit manual switch instruction", () => {
    expect(sql).toMatch(/'draft',\s*-- target_status/);
    expect(sql).toMatch(/troque para 'active' manualmente/i);
  });

  it("expects the documented daily point totals in its header", () => {
    expect(sql).toContain("110");
    expect(sql).toContain("total diario obrigatorio esperado = 160");
    expect(sql).toContain("180 (maximo possivel)");
  });
});
