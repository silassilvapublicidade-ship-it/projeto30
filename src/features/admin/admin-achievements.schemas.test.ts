import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENT_ICONS,
  ACHIEVEMENT_RULE_TYPES,
  achievementCreateSchema,
  achievementPreviewSchema,
  achievementUpdateSchema,
  getAchievementRuleDefinition,
  getAchievementRuleDefinitionBySlug,
} from "./admin-achievements.schemas";

// The exact 10 (slug, type, ruleConfig) triples seeded since
// 0002_daily_journey_core.sql and hardcoded into finalize_daily_log()'s
// `a.slug in (...)` filter (0016). A rule type here that doesn't match one
// of these exactly would create an achievement the unlock engine can never
// evaluate - so this test pins the list against the real migration text
// itself, not just against a second hand-written copy in this test file.
const EXPECTED_RULE_TYPES: Array<{ ruleConfig: string; slug: string; type: string }> = [
  { slug: "primeiro-habito", type: "first_habit", ruleConfig: '{"type": "first_habit"}' },
  { slug: "primeiro-dia", type: "first_day", ruleConfig: '{"type": "first_day"}' },
  { slug: "tres-dias-seguidos", type: "streak", ruleConfig: '{"type": "streak", "days": 3}' },
  { slug: "primeira-semana", type: "finalized_days", ruleConfig: '{"type": "finalized_days", "days": 7}' },
  {
    slug: "sete-leituras",
    type: "reading_completions",
    ruleConfig: '{"type": "reading_completions", "count": 7}',
  },
  {
    slug: "sete-atividades-fisicas",
    type: "physical_activity_completions",
    ruleConfig: '{"type": "physical_activity_completions", "count": 7}',
  },
  {
    slug: "sete-reflexoes",
    type: "reflection_days",
    ruleConfig: '{"type": "reflection_days", "count": 7}',
  },
  { slug: "metade-do-caminho", type: "halfway", ruleConfig: '{"type": "halfway"}' },
  { slug: "retorno-forte", type: "return_after_break", ruleConfig: '{"type": "return_after_break"}' },
  { slug: "missao-concluida", type: "challenge_completed", ruleConfig: '{"type": "challenge_completed"}' },
];

describe("ACHIEVEMENT_RULE_TYPES", () => {
  it("has exactly the 10 canonical types, nothing invented", () => {
    expect(ACHIEVEMENT_RULE_TYPES).toHaveLength(10);
    expect(ACHIEVEMENT_RULE_TYPES.map((rule) => rule.slug).sort()).toEqual(
      EXPECTED_RULE_TYPES.map((rule) => rule.slug).sort(),
    );
  });

  it("every slug/type/ruleConfig here is byte-for-byte seeded in 0002_daily_journey_core.sql", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "0002_daily_journey_core.sql"),
      "utf8",
    );

    for (const expected of EXPECTED_RULE_TYPES) {
      const definition = getAchievementRuleDefinitionBySlug(expected.slug);
      expect(definition, `${expected.slug} should be defined`).toBeDefined();
      expect(definition?.type).toBe(expected.type);
      expect(JSON.stringify(definition?.ruleConfig)).toBe(JSON.stringify(JSON.parse(expected.ruleConfig)));

      // The seed row itself, so a future rewrite of 0002 can't silently
      // drift from what this module claims to represent.
      expect(migration).toContain(`'${expected.slug}'`);
      expect(migration).toContain(expected.ruleConfig);
    }
  });

  it("every slug also appears in finalize_daily_log's evaluation filter (0016) - otherwise it would never unlock", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "0016_analytics_events_instrumentation.sql"),
      "utf8",
    );

    for (const rule of ACHIEVEMENT_RULE_TYPES) {
      expect(migration).toContain(`'${rule.slug}'`);
    }
  });

  it("getAchievementRuleDefinition and getAchievementRuleDefinitionBySlug find the same entry", () => {
    for (const rule of ACHIEVEMENT_RULE_TYPES) {
      expect(getAchievementRuleDefinition(rule.type)).toBe(rule);
      expect(getAchievementRuleDefinitionBySlug(rule.slug)).toBe(rule);
    }
  });

  it("returns undefined for an unknown type/slug rather than throwing", () => {
    expect(getAchievementRuleDefinition("made-up-type")).toBeUndefined();
    expect(getAchievementRuleDefinitionBySlug("made-up-slug")).toBeUndefined();
  });
});

describe("ACHIEVEMENT_ICONS", () => {
  it("is a fixed, non-empty list of lucide-style kebab-case names", () => {
    expect(ACHIEVEMENT_ICONS.length).toBeGreaterThan(0);
    for (const icon of ACHIEVEMENT_ICONS) {
      expect(icon).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it("includes every icon already used by a real seeded achievement", () => {
    for (const rule of ACHIEVEMENT_RULE_TYPES) {
      expect(ACHIEVEMENT_ICONS).toContain(rule.defaultIcon);
    }
  });
});

describe("achievementCreateSchema", () => {
  const valid = {
    challengeId: "11111111-1111-4111-8111-111111111111",
    name: "Primeiro hábito",
    ruleType: "first_habit",
  };

  it("accepts the minimal required fields and defaults pointsBonus/sortOrder to 0", () => {
    const result = achievementCreateSchema.parse(valid);
    expect(result.pointsBonus).toBe(0);
    expect(result.sortOrder).toBe(0);
  });

  it("rejects a challengeId that isn't a UUID", () => {
    expect(achievementCreateSchema.safeParse({ ...valid, challengeId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a ruleType outside the 10 canonical values", () => {
    expect(achievementCreateSchema.safeParse({ ...valid, ruleType: "custom_rule" }).success).toBe(false);
  });

  it("rejects a name shorter than 3 characters", () => {
    expect(achievementCreateSchema.safeParse({ ...valid, name: "Ab" }).success).toBe(false);
  });

  it("rejects an icon outside the fixed picker", () => {
    expect(achievementCreateSchema.safeParse({ ...valid, icon: "not-a-real-icon" }).success).toBe(false);
  });

  it("rejects a negative pointsBonus", () => {
    expect(achievementCreateSchema.safeParse({ ...valid, pointsBonus: "-5" }).success).toBe(false);
  });
});

describe("achievementUpdateSchema", () => {
  it("never accepts challengeId, ruleType or slug fields (not part of the schema at all)", () => {
    const shape = achievementUpdateSchema as unknown as { shape?: Record<string, unknown> };
    expect(shape.shape).not.toHaveProperty("challengeId");
    expect(shape.shape).not.toHaveProperty("ruleType");
    expect(shape.shape).not.toHaveProperty("slug");
    expect(shape.shape).not.toHaveProperty("ruleConfig");
  });

  it("defaults active to true when omitted", () => {
    const result = achievementUpdateSchema.parse({ name: "Nome válido" });
    expect(result.active).toBe(true);
  });
});

describe("achievementPreviewSchema", () => {
  it("defaults format to feed", () => {
    expect(achievementPreviewSchema.parse({ name: "X" }).format).toBe("feed");
  });

  it("rejects an empty name", () => {
    expect(achievementPreviewSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a format outside story/feed", () => {
    expect(achievementPreviewSchema.safeParse({ name: "X", format: "square" }).success).toBe(false);
  });
});
