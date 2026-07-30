import { describe, expect, it } from "vitest";

import { resolveHabitLogValueJson } from "./habit-log-value.core";

describe("resolveHabitLogValueJson", () => {
  it("stores a minimal placeholder numeric value when marking a habit completed", () => {
    expect(resolveHabitLogValueJson("completed")).toEqual({ value: 1 });
  });

  it("keeps an empty value_json for pending (unmarking)", () => {
    expect(resolveHabitLogValueJson("pending")).toEqual({});
  });

  it("keeps an empty value_json for not_applicable", () => {
    expect(resolveHabitLogValueJson("not_applicable")).toEqual({});
  });

  it("keeps an empty value_json for skipped", () => {
    expect(resolveHabitLogValueJson("skipped")).toEqual({});
  });
});
