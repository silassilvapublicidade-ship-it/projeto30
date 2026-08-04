import { describe, expect, it } from "vitest";

import { shouldAnimateNumberChange } from "./animated-number.core";

describe("shouldAnimateNumberChange", () => {
  it("animates on first entry of the session (no previous value seen yet)", () => {
    expect(shouldAnimateNumberChange({ previousValue: null, value: 390 })).toBe(true);
  });

  it("animates when the value really changed since last seen", () => {
    expect(shouldAnimateNumberChange({ previousValue: 310, value: 390 })).toBe(true);
  });

  it("never animates when returning to the same screen with the exact same value", () => {
    expect(shouldAnimateNumberChange({ previousValue: 390, value: 390 })).toBe(false);
  });

  it("treats zero as a real, distinct previous value - not the same as 'never seen'", () => {
    expect(shouldAnimateNumberChange({ previousValue: 0, value: 0 })).toBe(false);
    expect(shouldAnimateNumberChange({ previousValue: 0, value: 5 })).toBe(true);
  });
});
