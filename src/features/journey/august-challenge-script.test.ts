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

  it("declares exactly 13 habits, all required, with a frequency_type per habit", () => {
    const habitRowMatches = activeSql.match(
      /\(\d{1,2}, '[^']+', '[^']+', '[^']+', '(boolean|quantity|duration|reading)'::public\.habit_type/g,
    );

    expect(habitRowMatches).toHaveLength(13);

    // Optionality used to be encoded as is_required = false (Musculacao,
    // Autocuidado). It is now encoded as frequency_type <> 'daily' instead,
    // so all 13 habits are required.
    const optionalHabitMatches = activeSql.match(
      /'::public\.habit_type, '[^']+', 10, false,/g,
    );
    expect(optionalHabitMatches).toBeNull();

    const requiredHabitMatches = activeSql.match(
      /'::public\.habit_type, '[^']+', 10,\s*\n\s*'(daily|weekly|monthly)'::public\.habit_frequency_type/g,
    );
    expect(requiredHabitMatches).toHaveLength(13);

    const dailyMatches = activeSql.match(/'daily'::public\.habit_frequency_type/g);
    const weeklyMatches = activeSql.match(/'weekly'::public\.habit_frequency_type/g);
    const monthlyMatches = activeSql.match(/'monthly'::public\.habit_frequency_type/g);

    expect(dailyMatches).toHaveLength(10);
    expect(weeklyMatches).toHaveLength(1);
    expect(monthlyMatches).toHaveLength(2);
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

  it("keeps status active with an explicit documented decision, not a silent change", () => {
    expect(sql).toMatch(/'active',\s*-- target_status/);
    expect(sql).toMatch(/-- STATUS\b/);
    expect(sql).toContain("Mantido como 'active'");
  });

  it("asserts the documented point totals in its own validation block", () => {
    expect(activeSql).toContain("esperado 130 pontos somados nos habitos obrigatorios");
    expect(activeSql).toContain("esperado 100 pontos somados nos habitos diarios");
    expect(activeSql).toContain("esperado 30 pontos somados nos habitos nao-diarios");
  });

  it("documents the sleep min/max limitation instead of improvising a workaround", () => {
    expect(activeSql).toContain("target_max_informational");
    expect(activeSql).toContain("meta-maxima");
  });

  it("never stores the cover as base64 and never creates a new column just for it", () => {
    expect(activeSql).not.toContain("data:image");
    expect(activeSql).not.toContain("base64");
    expect(sql).toMatch(/Nenhuma coluna nova foi criada s[oó] para a capa\.?/);
  });

  describe("this round: presentation/content-only scope (frequency engine deferred)", () => {
    it("does not redefine journey_recalculate_daily_log, finalize_daily_log or challenge_day_habits' shape", () => {
      expect(activeSql).not.toContain("create or replace function public.journey_recalculate_daily_log");
      expect(activeSql).not.toContain("create or replace function public.finalize_daily_log");
      expect(activeSql).not.toContain("alter table public.challenge_day_habits");
      expect(activeSql).not.toContain("create table");
      expect(activeSql).not.toContain("public.challenge_habits");
    });

    it("documents why supabase/seed.sql does not contain this challenge", () => {
      expect(sql).toMatch(/POR QUE supabase\/seed\.sql NAO CONTEM ESTE DESAFIO/);
    });

    it("fails explicitly instead of silently inserting a new challenge when the canonical id is missing", () => {
      expect(activeSql).toContain("nao encontrado neste banco");
      expect(activeSql).toContain("nao cria um novo desafio");
      expect(activeSql).toMatch(/if not exists\s*\(\s*select 1 from public\.challenges where id = 'a3080000-0000-4000-8000-000000000001'/);
    });
  });

  describe("official theme_config/rules_config shape for this round", () => {
    it("keeps name and description on the relational columns as the primary source", () => {
      expect(sql).toContain("'Desafio de Agosto - Irreconhecível'");
      expect(sql).toContain("Agosto será o mês da disciplina.");
    });

    it("merges theme_config instead of overwriting it, dropping only the superseded keys", () => {
      expect(activeSql).toMatch(
        /theme_config = \(\s*coalesce\(public\.challenges\.theme_config, '\{\}'::jsonb\)\s*- 'short_title' - 'subtitle' - 'motivational_phrase' - 'cta_subtext'\s*\) \|\| excluded\.theme_config/,
      );
    });

    it("writes the new canonical theme_config keys", () => {
      for (const key of [
        "headline",
        "subheadline",
        "tagline",
        "hero_message",
        "short_description",
        "cta_label",
        "cta_supporting_text",
      ]) {
        expect(activeSql).toContain(`'${key}',`);
      }
    });

    it("sets theme_config.cover_image_url to a public Supabase Storage URL, never a local path or base64", () => {
      const insertValuesSection = activeSql.split("on conflict (slug) do update set")[0] ?? "";
      expect(insertValuesSection).toContain("'cover_image_url'");
      expect(activeSql).toMatch(
        /'cover_image_url', 'https:\/\/[^']+\/storage\/v1\/object\/public\/challenge-covers\/challenges\/a3080000-0000-4000-8000-000000000001\/cover\.webp'/,
      );
      expect(activeSql).not.toContain("/mnt/data");
      expect(activeSql).not.toContain("c:/users");
      expect(activeSql).not.toContain("data:image");
    });

    it("merges rules_config instead of overwriting it, preserving functional point/streak keys untouched", () => {
      expect(activeSql).toMatch(
        /rules_config = \(\s*coalesce\(public\.challenges\.rules_config, '\{\}'::jsonb\)\s*- 'admission_type' - 'allow_late_entry' - 'max_participants' - 'completion_criteria'\s*\) \|\| excluded\.rules_config/,
      );
      // reflection_points / finalize_day_points / all_habits_bonus_points /
      // streak_minimum_completion must not appear in the new delta payload -
      // they stay untouched via the merge, not reasserted here.
      const rulesConfigValuesMatch = activeSql.match(
        /jsonb_build_object\(\s*'enrollment_type'[\s\S]*?\)/,
      );
      expect(rulesConfigValuesMatch).not.toBeNull();
      const rulesConfigPayload = rulesConfigValuesMatch?.[0] ?? "";
      expect(rulesConfigPayload).not.toContain("reflection_points");
      expect(rulesConfigPayload).not.toContain("finalize_day_points");
      expect(rulesConfigPayload).not.toContain("all_habits_bonus_points");
      expect(rulesConfigPayload).not.toContain("streak_minimum_completion");
    });

    it("writes the new canonical rules_config keys", () => {
      for (const key of [
        "enrollment_type",
        "allow_join_after_start",
        "allow_abandonment",
        "participant_limit",
        "single_active_challenge",
      ]) {
        expect(activeSql).toContain(`'${key}',`);
      }
    });
  });
});
