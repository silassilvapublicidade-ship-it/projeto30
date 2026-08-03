import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RARITY_TIERS_ORDER } from "@/features/achievements/achievement-rarity.core";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0040_achievement_rarity_category_backfill.sql"),
    "utf8",
  );
}

const CANONICAL_SLUGS = [
  "primeiro-habito",
  "primeiro-dia",
  "tres-dias-seguidos",
  "primeira-semana",
  "sete-leituras",
  "sete-atividades-fisicas",
  "sete-reflexoes",
  "metade-do-caminho",
  "retorno-forte",
  "missao-concluida",
];

describe("Migration 0040 - achievement rarity/category backfill", () => {
  const migration = readMigration();

  it("sets a rarity for every one of the 10 canonical achievements", () => {
    for (const slug of CANONICAL_SLUGS) {
      expect(migration, `expected an update targeting "${slug}"`).toContain(`'${slug}'`);
    }
  });

  it("only ever uses real tier values the render engine understands", () => {
    for (const tier of RARITY_TIERS_ORDER) {
      expect(migration).toContain(`rarity = '${tier}'`);
    }
    // No stray rarity value outside the 4 real tiers.
    const rarityValues = [...migration.matchAll(/rarity = '([a-z]+)'/g)].map((match) => match[1]);
    for (const value of rarityValues) {
      expect(RARITY_TIERS_ORDER).toContain(value);
    }
  });

  it("never deletes rows or drops anything - purely a data backfill", () => {
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("drop column");
  });

  it("simplifies share_templates.config to structural fields only, dropping the old free-color fields", () => {
    const configBlock = migration.slice(migration.indexOf("update public.share_templates"));
    expect(configBlock).toContain("jsonb_build_object(");
    expect(configBlock).toContain("'format'");
    expect(configBlock).toContain("'height'");
    expect(configBlock).toContain("'width'");
    expect(configBlock).not.toContain("accentColor");
    expect(configBlock).not.toContain("showChallengeBranding");
  });

  it("only targets the two real achievement share-card templates", () => {
    expect(migration).toContain("'achievement_story'");
    expect(migration).toContain("'achievement_feed'");
  });
});
