import type { Json } from "@/types/database";

function isJsonRecord(value: Json): value is { [key: string]: Json } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * Extracted from member-area.service.ts's private getRuleInt (identical
 * behavior, now shared) so journey.service.ts and the streak explanation
 * copy can read the same rule without a second, possibly-diverging copy.
 * Not a mirror of journey_rule_int's exact validation (that one rejects any
 * non-integer string outright; this one floors a numeric JSON value) - that
 * gap predates this change and is out of scope here.
 */
export function readRuleInt(rulesConfig: Json, key: string, fallback: number): number {
  const rules = isJsonRecord(rulesConfig) ? rulesConfig : {};
  const value = rules[key];

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return fallback;
}

export function readStreakMinimumCompletion(rulesConfig: Json): number {
  return readRuleInt(rulesConfig, "streak_minimum_completion", 70);
}
