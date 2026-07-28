import { describe, expect, it } from "vitest";

import { isAdminRole } from "./admin-access.core";

describe("isAdminRole", () => {
  it("allows admin and super_admin", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
  });

  it("rejects user and moderator", () => {
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole("moderator")).toBe(false);
  });

  it("rejects missing role", () => {
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
