import { describe, expect, it } from "vitest";

import {
  challengeDayMessageRangeSchema,
  challengeDayMessageSchema,
  DAY_MESSAGE_MAX_LENGTH,
} from "./challenge-editor.schemas";

describe("challengeDayMessageSchema (Correções obrigatórias pré-lançamento, Parte D)", () => {
  it("accepts a real day number with a message", () => {
    const result = challengeDayMessageSchema.safeParse({ dayNumber: "3", message: "Continue firme." });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dayNumber).toBe(3);
      expect(result.data.message).toBe("Continue firme.");
    }
  });

  it("message is optional - never requires every day to have one", () => {
    const result = challengeDayMessageSchema.safeParse({ dayNumber: "3" });
    expect(result.success).toBe(true);
  });

  it("an empty string message is valid (means: clear it)", () => {
    const result = challengeDayMessageSchema.safeParse({ dayNumber: "1", message: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a message longer than the max length", () => {
    const tooLong = "a".repeat(DAY_MESSAGE_MAX_LENGTH + 1);
    const result = challengeDayMessageSchema.safeParse({ dayNumber: "1", message: tooLong });
    expect(result.success).toBe(false);
  });

  it("accepts a message exactly at the max length boundary", () => {
    const exact = "a".repeat(DAY_MESSAGE_MAX_LENGTH);
    const result = challengeDayMessageSchema.safeParse({ dayNumber: "1", message: exact });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive or non-integer day number", () => {
    expect(challengeDayMessageSchema.safeParse({ dayNumber: "0", message: "x" }).success).toBe(false);
    expect(challengeDayMessageSchema.safeParse({ dayNumber: "-1", message: "x" }).success).toBe(false);
    expect(challengeDayMessageSchema.safeParse({ dayNumber: "abc", message: "x" }).success).toBe(false);
  });
});

describe("challengeDayMessageRangeSchema", () => {
  it("accepts a valid ascending range", () => {
    const result = challengeDayMessageRangeSchema.safeParse({
      sourceDayNumber: "1",
      targetRangeEnd: "10",
      targetRangeStart: "2",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a single-day range (start === end)", () => {
    const result = challengeDayMessageRangeSchema.safeParse({
      sourceDayNumber: "1",
      targetRangeEnd: "5",
      targetRangeStart: "5",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an inverted range (start after end)", () => {
    const result = challengeDayMessageRangeSchema.safeParse({
      sourceDayNumber: "1",
      targetRangeEnd: "3",
      targetRangeStart: "10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive day numbers anywhere in the range", () => {
    const result = challengeDayMessageRangeSchema.safeParse({
      sourceDayNumber: "1",
      targetRangeEnd: "5",
      targetRangeStart: "0",
    });
    expect(result.success).toBe(false);
  });
});
