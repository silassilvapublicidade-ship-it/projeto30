import { describe, expect, it } from "vitest";

import {
  ADMIN_PAGE_SIZE,
  getOffset,
  getTotalPages,
  parseChallengeListParams,
  parseParticipantListParams,
} from "./admin-analytics.schemas";

describe("parseChallengeListParams", () => {
  it("applies safe defaults when no params are given", () => {
    expect(parseChallengeListParams({})).toEqual({
      page: 1,
      search: undefined,
      sortBy: "created_at",
      sortDir: "desc",
      status: undefined,
    });
  });

  it("parses valid filters and sort", () => {
    expect(
      parseChallengeListParams({
        page: "3",
        search: "  agosto  ",
        sortBy: "participant_count",
        sortDir: "asc",
        status: "active",
      }),
    ).toEqual({
      page: 3,
      search: "agosto",
      sortBy: "participant_count",
      sortDir: "asc",
      status: "active",
    });
  });

  it("falls back to defaults for invalid enum values instead of throwing", () => {
    const result = parseChallengeListParams({
      page: "not-a-number",
      sortBy: "definitely-not-a-column",
      sortDir: "sideways",
      status: "deleted",
    });

    expect(result.page).toBe(1);
    expect(result.sortBy).toBe("created_at");
    expect(result.sortDir).toBe("desc");
    expect(result.status).toBeUndefined();
  });

  it("takes the first value when a param is duplicated in the query string", () => {
    const result = parseChallengeListParams({ status: ["active", "draft"] });
    expect(result.status).toBe("active");
  });
});

describe("parseParticipantListParams", () => {
  it("applies safe defaults", () => {
    const result = parseParticipantListParams({});
    expect(result).toEqual({
      activity: undefined,
      maxProgress: undefined,
      minProgress: undefined,
      page: 1,
      search: undefined,
      sortBy: "joined_at",
      sortDir: "desc",
      status: undefined,
    });
  });

  it("parses numeric progress bounds", () => {
    const result = parseParticipantListParams({
      activity: "active",
      maxProgress: "80",
      minProgress: "20",
    });

    expect(result.activity).toBe("active");
    expect(result.minProgress).toBe(20);
    expect(result.maxProgress).toBe(80);
  });

  it("ignores non-numeric progress bounds", () => {
    const result = parseParticipantListParams({
      maxProgress: "abc",
      minProgress: "",
    });

    expect(result.minProgress).toBeUndefined();
    expect(result.maxProgress).toBeUndefined();
  });
});

describe("pagination helpers", () => {
  it("computes offsets from the configured page size", () => {
    expect(getOffset(1)).toBe(0);
    expect(getOffset(2)).toBe(ADMIN_PAGE_SIZE);
    expect(getOffset(3, 10)).toBe(20);
  });

  it("never returns a negative offset", () => {
    expect(getOffset(0)).toBe(0);
    expect(getOffset(-5)).toBe(0);
  });

  it("computes total pages, always at least 1", () => {
    expect(getTotalPages(0)).toBe(1);
    expect(getTotalPages(1)).toBe(1);
    expect(getTotalPages(ADMIN_PAGE_SIZE)).toBe(1);
    expect(getTotalPages(ADMIN_PAGE_SIZE + 1)).toBe(2);
    expect(getTotalPages(45, 10)).toBe(5);
  });
});
