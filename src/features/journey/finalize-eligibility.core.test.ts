import { describe, expect, it } from "vitest";

import { getFinalizeEligibility } from "./finalize-eligibility.core";

describe("getFinalizeEligibility", () => {
  it("blocks finalization when a required habit is pending", () => {
    const result = getFinalizeEligibility([
      { habitId: "water", required: true, status: "completed" },
      { habitId: "sleep", required: true, status: "pending" },
    ]);

    expect(result).toEqual({
      canFinalize: false,
      missingRequiredHabitIds: ["sleep"],
    });
  });

  it("blocks finalization when a required habit has no log at all", () => {
    const result = getFinalizeEligibility([
      { habitId: "water", required: true, status: null },
    ]);

    expect(result.canFinalize).toBe(false);
    expect(result.missingRequiredHabitIds).toEqual(["water"]);
  });

  it("blocks finalization when a required habit is marked not_applicable", () => {
    const result = getFinalizeEligibility([
      { habitId: "water", required: true, status: "not_applicable" },
    ]);

    expect(result.canFinalize).toBe(false);
    expect(result.missingRequiredHabitIds).toEqual(["water"]);
  });

  it("allows finalization when every required habit is completed", () => {
    const result = getFinalizeEligibility([
      { habitId: "water", required: true, status: "completed" },
      { habitId: "sleep", required: true, status: "completed" },
      { habitId: "training", required: false, status: "pending" },
    ]);

    expect(result).toEqual({ canFinalize: true, missingRequiredHabitIds: [] });
  });

  it("does not block on a pending optional habit", () => {
    const result = getFinalizeEligibility([
      { habitId: "water", required: true, status: "completed" },
      { habitId: "training", required: false, status: "pending" },
    ]);

    expect(result.canFinalize).toBe(true);
  });

  it("does not block on an optional habit marked not_applicable", () => {
    const result = getFinalizeEligibility([
      { habitId: "water", required: true, status: "completed" },
      { habitId: "training", required: false, status: "not_applicable" },
    ]);

    expect(result.canFinalize).toBe(true);
  });
});
