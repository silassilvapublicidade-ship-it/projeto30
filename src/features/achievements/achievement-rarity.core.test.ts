import { describe, expect, it } from "vitest";

import { normalizeRarity, RARITY_TIERS, RARITY_TIERS_ORDER } from "./achievement-rarity.core";

describe("RARITY_TIERS", () => {
  it("has exactly the 4 documented tiers, in ascending order", () => {
    expect(RARITY_TIERS_ORDER).toEqual(["bronze", "prata", "ouro", "lendaria"]);
    expect(Object.keys(RARITY_TIERS).sort()).toEqual([...RARITY_TIERS_ORDER].sort());
  });

  it("every tier defines a real color config, never an empty/placeholder value", () => {
    for (const tier of RARITY_TIERS_ORDER) {
      const config = RARITY_TIERS[tier];
      expect(config.medalRing).toHaveLength(2);
      expect(config.medalRing[0]).toMatch(/^#/);
      expect(config.medalRing[1]).toMatch(/^#/);
      expect(config.label.length).toBeGreaterThan(0);
      expect(config.ringWidth).toBeGreaterThan(0);
    }
  });

  it("legendary is visibly the widest ring - the tier meant to read as rarest at a glance", () => {
    const widths = RARITY_TIERS_ORDER.map((tier) => RARITY_TIERS[tier].ringWidth);
    expect(RARITY_TIERS.lendaria.ringWidth).toBe(Math.max(...widths));
  });
});

describe("normalizeRarity", () => {
  it("maps every documented pt-BR synonym to its tier", () => {
    expect(normalizeRarity("bronze")).toBe("bronze");
    expect(normalizeRarity("comum")).toBe("bronze");
    expect(normalizeRarity("prata")).toBe("prata");
    expect(normalizeRarity("rara")).toBe("prata");
    expect(normalizeRarity("ouro")).toBe("ouro");
    expect(normalizeRarity("épica")).toBe("ouro");
    expect(normalizeRarity("lendária")).toBe("lendaria");
    expect(normalizeRarity("legendary")).toBe("lendaria");
  });

  it("is case/whitespace insensitive", () => {
    expect(normalizeRarity("  OURO  ")).toBe("ouro");
    expect(normalizeRarity("Prata")).toBe("prata");
  });

  it("defaults to bronze for null, empty, or unrecognized input - never throws", () => {
    expect(normalizeRarity(null)).toBe("bronze");
    expect(normalizeRarity(undefined)).toBe("bronze");
    expect(normalizeRarity("")).toBe("bronze");
    expect(normalizeRarity("algo-inventado")).toBe("bronze");
  });
});
