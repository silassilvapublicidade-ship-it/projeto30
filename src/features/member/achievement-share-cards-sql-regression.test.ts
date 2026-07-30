import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", "0014_achievement_share_cards.sql"),
    "utf8",
  );
}

describe("achievement share cards SQL migration", () => {
  const migration = readMigration();

  it("reuses share_templates/share_cards instead of creating parallel tables", () => {
    expect(migration).not.toMatch(/create table (if not exists )?public\.achievement_cards/i);
    expect(migration).not.toMatch(/create table (if not exists )?public\.achievement_share/i);
    expect(migration).toContain("alter table public.share_templates");
    expect(migration).toContain("alter table public.share_cards");
  });

  it("never removes an existing column", () => {
    expect(migration).not.toContain("drop column");
  });

  it("makes share_templates.challenge_id nullable for global presets, and adds a stable slug", () => {
    expect(migration).toContain("alter column challenge_id drop not null");
    expect(migration).toContain("add column if not exists slug text");
  });

  it("makes share_cards.daily_log_id nullable and adds the achievement anchor columns", () => {
    expect(migration).toContain("alter column daily_log_id drop not null");
    expect(migration).toContain("achievement_id uuid references public.achievements(id)");
    expect(migration).toContain("user_achievement_id uuid references public.user_achievements(id)");
  });

  it("enforces exactly one anchor per card via a check constraint", () => {
    expect(migration).toContain("share_cards_anchor_check");
    expect(migration).toContain("card_type = 'progress' and daily_log_id is not null");
    expect(migration).toContain("card_type = 'achievement' and user_achievement_id is not null");
  });

  it("replaces the composite template FK with a simple one (global templates can't share the card's challenge_id)", () => {
    expect(migration).toContain("drop constraint if exists share_cards_template_id_challenge_id_fkey");
    expect(migration).toContain("foreign key (template_id) references public.share_templates(id)");
  });

  it("adds a non-partial unique index for idempotent generation (never a duplicate card per unlock+template)", () => {
    const statement = migration
      .split("create unique index if not exists share_cards_user_achievement_template_unique")[1]
      ?.split(";")[0];
    expect(statement).toBeDefined();
    expect(statement).not.toMatch(/where/i);
  });

  it("creates a dedicated bucket with public read only (no authenticated/anon write policy)", () => {
    expect(migration).toContain("achievement-share-cards");
    expect(migration).toContain("Achievement share cards are publicly readable");
    expect(migration).not.toMatch(/achievement-share-cards[\s\S]*?to authenticated[\s\S]*?insert/i);
  });

  it("seeds exactly the two official presets with the documented dimensions", () => {
    expect(migration).toContain("'achievement_story'");
    expect(migration).toContain("'achievement_feed'");
    expect(migration).toContain("'width', 1080");
    expect(migration).toContain("'height', 1920");
    expect(migration).toContain("'height', 1350");
  });

  it("never deletes rows or drops tables", () => {
    expect(migration).not.toContain("delete from");
    expect(migration).not.toContain("drop table");
  });
});
