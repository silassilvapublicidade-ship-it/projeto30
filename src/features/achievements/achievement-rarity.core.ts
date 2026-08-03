export const RARITY_TIERS_ORDER = ["bronze", "prata", "ouro", "lendaria"] as const;

export type RarityTier = (typeof RARITY_TIERS_ORDER)[number];

export type RarityTierConfig = {
  glowColor: string;
  label: string;
  medalRing: [string, string];
  outlineColor: string;
  particleColor: string;
  ringWidth: number;
};

/**
 * Every color here is one of the app's existing brand tokens
 * (src/app/globals.css) - never a new/arbitrary hue. Bronze intentionally
 * reuses the same orange as the rest of the product (it's the "default"
 * tier, most achievements start here); Lendaria is the only tier that
 * combines both accent hues (orange + amber) and gets the widest ring -
 * it's meant to look visibly rarer than the other three at a glance.
 */
export const RARITY_TIERS: Record<RarityTier, RarityTierConfig> = {
  bronze: {
    glowColor: "rgba(255, 106, 0, 0.28)",
    label: "Bronze",
    medalRing: ["#7a4a24", "#c97a3a"],
    outlineColor: "#c97a3a",
    particleColor: "#ff9a3d",
    ringWidth: 10,
  },
  prata: {
    glowColor: "rgba(201, 205, 211, 0.24)",
    label: "Prata",
    medalRing: ["#7c838b", "#c9cdd3"],
    outlineColor: "#c9cdd3",
    particleColor: "#e4e7eb",
    ringWidth: 12,
  },
  ouro: {
    glowColor: "rgba(242, 169, 59, 0.34)",
    label: "Ouro",
    medalRing: ["#8a5a12", "#f2a93b"],
    outlineColor: "#ffcb73",
    particleColor: "#ffcb73",
    ringWidth: 14,
  },
  lendaria: {
    glowColor: "rgba(255, 106, 0, 0.42)",
    label: "Lendária",
    medalRing: ["#ff6a00", "#f2a93b"],
    outlineColor: "#ffcb73",
    particleColor: "#ff9a3d",
    ringWidth: 18,
  },
};

const RARITY_SYNONYMS: Record<string, RarityTier> = {
  bronze: "bronze",
  comum: "bronze",
  common: "bronze",
  epica: "ouro",
  "épica": "ouro",
  epic: "ouro",
  gold: "ouro",
  lendaria: "lendaria",
  "lendária": "lendaria",
  legendary: "lendaria",
  ouro: "ouro",
  prata: "prata",
  rara: "prata",
  rare: "prata",
  silver: "prata",
};

/**
 * The admin form's rarity field is free text (hint copy: "comum, rara,
 * épica, lendária") - this normalizes whatever was typed (or nothing) into
 * one of the 4 real tiers the render engine understands. Unrecognized/empty
 * input defaults to bronze rather than throwing, since a draft achievement
 * with no rarity set yet must still render a valid card.
 */
export function normalizeRarity(raw: string | null | undefined): RarityTier {
  const key = raw?.trim().toLowerCase();

  if (!key) {
    return "bronze";
  }

  return RARITY_SYNONYMS[key] ?? "bronze";
}
