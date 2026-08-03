import { describe, expect, it } from "vitest";

import { readRuleInt, readStreakMinimumCompletion } from "./rules.core";

describe("readRuleInt", () => {
  it("reads a numeric JSON value and floors it", () => {
    expect(readRuleInt({ streak_minimum_completion: 70.9 }, "streak_minimum_completion", 50)).toBe(70);
  });

  it("reads a digits-only string value", () => {
    expect(readRuleInt({ finalize_day_points: "15" }, "finalize_day_points", 10)).toBe(15);
  });

  it("falls back for a missing key", () => {
    expect(readRuleInt({}, "streak_minimum_completion", 70)).toBe(70);
  });

  it("falls back for a negative or non-numeric-string value", () => {
    expect(readRuleInt({ streak_minimum_completion: -5 }, "streak_minimum_completion", 70)).toBe(70);
    expect(readRuleInt({ streak_minimum_completion: "abc" }, "streak_minimum_completion", 70)).toBe(70);
  });

  it("falls back when rules_config isn't an object", () => {
    expect(readRuleInt(null, "streak_minimum_completion", 70)).toBe(70);
    expect(readRuleInt("not-an-object", "streak_minimum_completion", 70)).toBe(70);
  });
});

describe("readStreakMinimumCompletion", () => {
  it("defaults to 70 when unset - matches the RPC's own default", () => {
    expect(readStreakMinimumCompletion({})).toBe(70);
  });

  it("reads a custom configured value", () => {
    expect(readStreakMinimumCompletion({ streak_minimum_completion: 80 })).toBe(80);
  });
});
