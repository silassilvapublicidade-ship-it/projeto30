import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initialAchievementSlugs } from "../achievements/achievements.core";

const scriptPath = join(
  process.cwd(),
  "scripts",
  "challenges",
  "create-september-efata.sql",
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

/**
 * Same regression-test shape as august-challenge-script.test.ts (mirrored
 * on purpose - both are the same kind of artifact: a one-off
 * administrative SQL script, run manually via `supabase db query
 * --linked`, never through the app's server/client code). This is source
 * regression by design, not a claim of runtime confirmation - the real
 * runtime confirmation for this script already happened against
 * production, in a rolled-back transaction first (dry run: 1 challenge,
 * 30 days, 15 habits, 450 links, 10 achievements, 4 notifications, status
 * draft - zero errors from the script's own internal validation block),
 * then applied for real and re-run a second time to prove idempotency
 * (identical counts, no duplicate rows), with August's own row count
 * (14 habits, 4 real enrollments, status active) reconfirmed unchanged
 * immediately after.
 */
describe("september efata challenge administrative script", () => {
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

  it("uses a UUID range distinct from August and from the internal validation challenge", () => {
    expect(activeSql).toContain("a3090000-0000-4000-8000-000000000001");

    // August's id must only ever appear as a read-only isolation guard/
    // check, never as a target of insert/update/delete.
    const augustMentions = activeSql.split("a3080000-0000-4000-8000-000000000001").length - 1;
    expect(augustMentions).toBeGreaterThan(0);
    expect(activeSql).not.toMatch(/insert into public\.\w+[\s\S]{0,200}a3080000-0000-4000-8000-000000000001/);
    expect(activeSql).not.toMatch(/update public\.\w+[\s\S]{0,200}a3080000-0000-4000-8000-000000000001/);
    expect(activeSql).not.toMatch(/delete from public\.\w+[\s\S]{0,200}a3080000-0000-4000-8000-000000000001/);

    // The internal validation challenge id (a2300000-...) only appears in
    // read-only, conditional isolation guards - never a hard requirement,
    // since it does not exist in every environment (confirmed: production
    // today has no such row), and never a write target.
    expect(activeSql).not.toMatch(/insert into public\.\w+[\s\S]{0,200}a2300000-0000-4000-8000-000000000001/);
    expect(activeSql).not.toMatch(/update public\.\w+[\s\S]{0,200}a2300000-0000-4000-8000-000000000001/);
  });

  it("targets the expected challenge slug", () => {
    expect(activeSql).toContain("desafio-setembro-efata");
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
      expect(activeSql).not.toMatch(new RegExp(`insert into public\\.${table}\\b`));
      expect(activeSql).not.toMatch(new RegExp(`update public\\.${table}\\b`));
      expect(activeSql).not.toMatch(new RegExp(`delete from public\\.${table}\\b`));
    }

    expect(activeSql).not.toContain("insert into auth.users");
  });

  it("never sends a notification - every habit reminder row is created disabled", () => {
    expect(activeSql).toContain("insert into public.challenge_habit_notifications");
    // Each tuple's 2nd field (right after the habit_id) is `enabled` -
    // matched positionally so this can't be confused with
    // only_if_not_completed (also boolean, same rows).
    const enabledFieldMatches = activeSql.match(/\('a3090000-0000-4000-8002-\d{12}', (true|false),/g) ?? [];
    expect(enabledFieldMatches).toHaveLength(4);
    expect(enabledFieldMatches.every((row) => row.endsWith("false,"))).toBe(true);
    // Reaffirmed on conflict too - a re-run can never flip a reminder on
    // (checked against the raw source since the comment itself, stripped
    // from activeSql, is part of what's being asserted here).
    expect(sql).toContain("enabled = false, -- reafirma desativado mesmo em reexecucao");
  });

  it("keeps the destructive cleanup procedure fully commented out", () => {
    expect(activeSql).not.toContain("delete from public.challenges");
    expect(activeSql).not.toContain("delete from public.habits");
    expect(activeSql).not.toContain("delete from public.challenge_days");
    expect(activeSql).not.toContain("delete from public.challenge_habit_notifications");
  });

  it("only reuses the existing canonical achievement slugs, never creating Efatá-exclusive ones", () => {
    for (const slug of initialAchievementSlugs) {
      expect(activeSql).toContain(`'${slug}'`);
    }

    const efataOnlySlugs = ["efata", "abra-se", "quatro-semanas-efata", "livro-do-mes-concluido"];
    for (const slug of efataOnlySlugs) {
      expect(activeSql).not.toContain(`'${slug}'`);
    }
  });

  it("declares exactly 15 habits (13 required items + 2 non-required book actions)", () => {
    const habitRowMatches = activeSql.match(
      /\(\d{1,2}, '[^']+', '[^']+', '[^']+', '(boolean|quantity|duration|reading)'::public\.habit_type/g,
    );
    expect(habitRowMatches).toHaveLength(15);

    const requiredTrueMatches = activeSql.match(/'::public\.habit_type, '[^']*', \d+,\s*\n\s*'[^']+', true,/g);
    const requiredFalseMatches = activeSql.match(/'::public\.habit_type, '[^']*', \d+,\s*\n\s*'[^']+', false,/g);
    expect(requiredTrueMatches).toHaveLength(13);
    expect(requiredFalseMatches).toHaveLength(2);

    const dailyMatches = activeSql.match(/'daily'::public\.habit_frequency_type/g);
    const weeklyMatches = activeSql.match(/'weekly'::public\.habit_frequency_type/g);
    const monthlyMatches = activeSql.match(/'monthly'::public\.habit_frequency_type/g);
    expect(dailyMatches).toHaveLength(11);
    expect(weeklyMatches).toHaveLength(2);
    expect(monthlyMatches).toHaveLength(2);
  });

  it("gives every habit a daily_prompt (the Hoje screen's sim/não question)", () => {
    const promptMatches = activeSql.match(/daily_prompt,\s*\n\s*sort_order,/);
    expect(promptMatches).not.toBeNull();
    // 15 distinct question strings ending in "?" inside the habit_catalog values list.
    const catalogMatch = sql.match(/with habit_catalog\(([\s\S]*?)\)\s*\n\s*insert into public\.habits/);
    expect(catalogMatch).not.toBeNull();
    const questionMatches = (catalogMatch?.[1] ?? "").match(/'[^']*\?[^']*'/g) ?? [];
    expect(questionMatches.length).toBeGreaterThanOrEqual(15);
  });

  it("declares exactly 30 day titles, 30 themes and 30 messages", () => {
    // "[^\\]]*" (never dotall-nongreedy across the whole file) so each
    // pattern anchors on ITS OWN array literal - title/theme/message never
    // contain a literal "]" internally, so this can't overshoot into a
    // neighboring array the way a naive "[\s\S]*?" would (all 3 blocks are
    // joined with "unnest(...)", not just the first "from unnest(...)").
    const titleArrayMatch = activeSql.match(
      /unnest\(array\[([^\]]*)\]\) with ordinality as t\(title, day_number\)/,
    );
    const titleCount = (titleArrayMatch?.[1] ?? "").split(",").filter((entry) => entry.trim().length > 0).length;
    expect(titleCount).toBe(30);

    const themeArrayMatch = activeSql.match(
      /unnest\(array\[([^\]]*)\]\) with ordinality as th\(theme, day_number\)/,
    );
    const themeCount = (themeArrayMatch?.[1] ?? "").split(",").filter((entry) => entry.trim().length > 0).length;
    expect(themeCount).toBe(30);

    const messageArrayMatch = activeSql.match(
      /unnest\(array\[([^\]]*)\]\) with ordinality as m\(message, day_number\)/,
    );
    // Messages contain internal commas (real sentences), so count quoted
    // string literals instead of splitting on ",".
    const messageCount = (messageArrayMatch?.[1] ?? "").match(/'[^']*'/g)?.length ?? 0;
    expect(messageCount).toBe(30);
  });

  it("uses the 4-week thematic structure from the brief (Ouvidos/Coração/Mente/Caminhos/Fechamento)", () => {
    for (const theme of ["ABRA OS OUVIDOS", "ABRA O CORAÇÃO", "ABRA A MENTE", "ABRA OS CAMINHOS", "FECHAMENTO"]) {
      expect(sql).toContain(theme);
    }
  });

  it("never presents a message as an invented Bible quote, and cites Mark 7:34 only as a thematic reference", () => {
    // No message line is wrapped in curly/smart quotes suggesting a verbatim citation.
    expect(sql).not.toMatch(/“[^”]*”\s*\(?(marcos|mateus|joão|lucas|salmos)/i);
    expect(sql).toContain("Marcos 7:34");
    expect(sql).toContain("referência temática");
  });

  it("uses only canonical habit types supported by the schema", () => {
    const disallowedTypes = ["text", "single_choice", "multiple_choice"];
    for (const type of disallowedTypes) {
      expect(activeSql).not.toContain(`'${type}'::public.habit_type`);
    }
  });

  it("keeps status draft always - never targets 'active' and reaffirms draft on every re-run", () => {
    expect(sql).toMatch(/'draft', -- target_status/);
    expect(sql).toContain("status = 'draft', -- nunca promovido por uma reexecucao deste script");
    expect(activeSql).not.toMatch(/'active',\s*--\s*target_status/);
  });

  it("asserts the documented point totals in its own validation block (130 required / 110 daily / 60 non-daily / 170 total)", () => {
    expect(activeSql).toContain("esperado 130 pontos somados nos hábitos obrigatórios".toLowerCase());
    expect(activeSql).toContain("esperado 110 pontos somados nos hábitos diários".toLowerCase());
    expect(activeSql).toContain("esperado 60 pontos somados nos hábitos não-diários".toLowerCase());
    expect(activeSql).toContain("esperado 170 pontos somados no total dos 15 hábitos".toLowerCase());
  });

  it("configures 'Concluir o livro do mês' visible only on the last day, and validates it in the script itself", () => {
    expect(activeSql).toContain(`'{"type": "last_day"}'::jsonb`);
    expect(activeSql).toContain("public.habit_visible_on_day(visibility_config, 30, 30) = true");
    expect(activeSql).toContain("public.habit_visible_on_day(visibility_config, 1, 30) = false");
  });

  it("documents the sleep min/max limitation instead of improvising a workaround", () => {
    expect(activeSql).toContain("target_max_informational");
    expect(activeSql).toContain("meta-máxima");
  });

  it("never generates a cover automatically and never invents a base64/local-path image", () => {
    expect(activeSql).not.toContain("data:image");
    expect(activeSql).not.toContain("base64");
    // Scoped to the challenge INSERT's own theme_config payload - the
    // validation block legitimately mentions 'cover_image_url' as text
    // (asserting its absence), which would be a false positive here.
    const insertValuesSection = activeSql.split("on conflict (slug) do update set")[0] ?? "";
    expect(insertValuesSection).not.toContain("'cover_image_url'");
    expect(activeSql).toContain("'cover_status', 'pending_review'");
    expect(sql).toContain("Capa pendente de revisão.");
  });

  it("documents 'essential' as a decorative validation_config key, never a new schema column", () => {
    expect(sql).not.toMatch(/add column.*is_essential/i);
    expect(activeSql).toContain('"essential": true');
    expect(activeSql).toContain('"essential": false');
    expect(sql).toMatch(/NAO existe como coluna no schema atual/i);
  });

  describe("this script: content-only scope (engine untouched, same as August)", () => {
    it("does not redefine journey_recalculate_daily_log, finalize_daily_log, or challenge_day_habits' shape, and creates no new table", () => {
      expect(activeSql).not.toContain("create or replace function public.journey_recalculate_daily_log");
      expect(activeSql).not.toContain("create or replace function public.finalize_daily_log");
      expect(activeSql).not.toContain("alter table public.challenge_day_habits");
      expect(activeSql).not.toContain("create table");
      expect(activeSql).not.toContain("public.challenge_habits");
    });

    it("fails explicitly instead of silently mixing data when the slug already exists under a different id", () => {
      expect(activeSql).toContain("ja existe com um id diferente");
      expect(activeSql).toMatch(
        /if exists\s*\(\s*select 1\s*\n\s*from public\.challenges\s*\n\s*where slug = 'desafio-setembro-efata'/,
      );
    });

    it("guards August's isolation as a hard precondition, and the internal validation challenge only conditionally", () => {
      expect(activeSql).toContain("desafio de agosto nao encontrado intacto");
      expect(activeSql).toMatch(/if exists \(select 1 from public\.challenges where id = 'a2300000-0000-4000-8000-000000000001'/);
    });
  });

  describe("theme_config/rules_config shape (same pattern as August's script)", () => {
    it("keeps name and description on the relational columns as the primary source", () => {
      expect(sql).toContain("'Desafio de Setembro - Efatá'");
      expect(sql).toContain("O Efatá é uma jornada de 30 dias");
    });

    it("merges theme_config instead of overwriting it", () => {
      expect(activeSql).toMatch(
        /theme_config = coalesce\(public\.challenges\.theme_config, '\{\}'::jsonb\) \|\| excluded\.theme_config/,
      );
    });

    it("writes the canonical theme_config keys plus the brief's slogans", () => {
      for (const key of [
        "headline",
        "subheadline",
        "tagline",
        "hero_message",
        "short_description",
        "cta_label",
        "cta_supporting_text",
        "slogan_primary",
        "slogan_secondary",
        "theme_reference",
      ]) {
        expect(activeSql).toContain(`'${key}',`);
      }
    });

    it("merges rules_config instead of overwriting it, and explicitly sets the same point/streak values confirmed live in August", () => {
      expect(activeSql).toMatch(
        /rules_config = coalesce\(public\.challenges\.rules_config, '\{\}'::jsonb\) \|\| excluded\.rules_config/,
      );
      expect(activeSql).toContain("'reflection_points', 10");
      expect(activeSql).toContain("'finalize_day_points', 10");
      expect(activeSql).toContain("'all_habits_bonus_points', 30");
      expect(activeSql).toContain("'streak_minimum_completion', 70");
    });

    it("writes the canonical rules_config adoption keys", () => {
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

  describe("validation block also checks zero enrollments and August's untouched habit count", () => {
    it("asserts zero enrollments for the new challenge", () => {
      expect(activeSql).toContain("esperado 0 inscrições no desafio de setembro".toLowerCase());
    });

    it("asserts August's habit count is still 14 (the real, current production value)", () => {
      expect(activeSql).toContain("esperado 14) - possível vazamento entre desafios".toLowerCase());
    });
  });
});
