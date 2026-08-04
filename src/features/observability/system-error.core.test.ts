import { describe, expect, it } from "vitest";

import {
  buildDiagnosticCopyText,
  containsForbiddenPattern,
  isSystemErrorArea,
  mapPostgresCodeToSeverity,
  sanitizeErrorText,
  sanitizeMetadata,
  SYSTEM_ERROR_AREAS,
} from "./system-error.core";

describe("isSystemErrorArea", () => {
  it("accepts every declared area", () => {
    for (const area of SYSTEM_ERROR_AREAS) {
      expect(isSystemErrorArea(area)).toBe(true);
    }
  });

  it("rejects an arbitrary string", () => {
    expect(isSystemErrorArea("marketing")).toBe(false);
    expect(isSystemErrorArea("")).toBe(false);
  });
});

describe("mapPostgresCodeToSeverity", () => {
  it("maps known recoverable/business-rule codes to warning", () => {
    expect(mapPostgresCodeToSeverity("42501")).toBe("warning");
    expect(mapPostgresCodeToSeverity("P0002")).toBe("warning");
    expect(mapPostgresCodeToSeverity("22023")).toBe("warning");
    expect(mapPostgresCodeToSeverity("23505")).toBe("warning");
  });

  it("maps unknown or missing codes to error - never silently downgraded to warning", () => {
    expect(mapPostgresCodeToSeverity("XX000")).toBe("error");
    expect(mapPostgresCodeToSeverity(null)).toBe("error");
    expect(mapPostgresCodeToSeverity(undefined)).toBe("error");
  });

  it("never returns critical or info - those are always an explicit choice by the caller", () => {
    for (const code of ["42501", "P0002", "22023", "XX000", null, undefined]) {
      const severity = mapPostgresCodeToSeverity(code);
      expect(severity).not.toBe("critical");
      expect(severity).not.toBe("info");
    }
  });
});

describe("containsForbiddenPattern / sanitizeErrorText", () => {
  it.each([
    "user password is 123456",
    "senha do usuário exposta",
    "token=abc123",
    "Authorization: Bearer xyz",
    "leaked service_role key",
    "api_key=sk-live-123",
    "contact silas@example.com for help",
  ])("flags %s as forbidden", (text) => {
    expect(containsForbiddenPattern(text)).toBe(true);
  });

  it("does not flag an ordinary technical message", () => {
    expect(containsForbiddenPattern("Falha ao renderizar a imagem do card de conquista.")).toBe(false);
  });

  it("strips control characters and collapses whitespace", () => {
    expect(sanitizeErrorText("linha\n\tcom\x00controle   e espaços")).toBe("linha com controle e espaços");
  });

  it("truncates to the requested max length", () => {
    const long = "a".repeat(600);
    expect(sanitizeErrorText(long, 500)).toHaveLength(500);
  });
});

describe("sanitizeMetadata", () => {
  it("keeps safe primitive values", () => {
    expect(sanitizeMetadata({ count: 3, ok: true, label: "cron" })).toEqual({
      count: 3,
      ok: true,
      label: "cron",
    });
  });

  it("drops any key or value matching a forbidden pattern", () => {
    const result = sanitizeMetadata({ safe: "ok", token: "abc", note: "contains a password here" });
    expect(result).toEqual({ safe: "ok" });
  });

  it("drops nested objects/arrays - only primitives ever pass through", () => {
    const result = sanitizeMetadata({ safe: "ok", nested: { a: 1 }, list: [1, 2, 3] });
    expect(result).toEqual({ safe: "ok" });
  });

  it("never throws on null/undefined/non-object input", () => {
    expect(sanitizeMetadata(null)).toEqual({});
    expect(sanitizeMetadata(undefined)).toEqual({});
  });

  it("caps the number of keys", () => {
    const input: Record<string, number> = {};
    for (let index = 0; index < 30; index += 1) {
      input[`key${index}`] = index;
    }
    const result = sanitizeMetadata(input);
    expect(Object.keys(result).length).toBeLessThanOrEqual(12);
  });

  it("caps the total serialized size", () => {
    const input: Record<string, string> = {};
    for (let index = 0; index < 12; index += 1) {
      input[`key${index}`] = "x".repeat(190);
    }
    const result = sanitizeMetadata(input);
    expect(Buffer.byteLength(JSON.stringify(result), "utf8")).toBeLessThanOrEqual(2000);
  });
});

describe("buildDiagnosticCopyText", () => {
  it("includes exactly the allowed fields - never a raw stack, user id or metadata", () => {
    const text = buildDiagnosticCopyText({
      appVersion: "abc1234",
      errorCode: "P30-CRON-20260804-A7F2",
      messageSafe: "Falha ao processar o cron.",
      occurredAt: "04/08/2026 09:00",
      operation: "notifications_process_run",
      route: "/api/cron/notifications/process",
    });

    expect(text).toContain("P30-CRON-20260804-A7F2");
    expect(text).toContain("04/08/2026 09:00");
    expect(text).toContain("/api/cron/notifications/process");
    expect(text).toContain("notifications_process_run");
    expect(text).toContain("Falha ao processar o cron.");
    expect(text).toContain("abc1234");
    expect(text).not.toMatch(/user_id|userId|stack|postgres_code/i);
  });

  it("includes the browser only when the caller provides it", () => {
    const withoutBrowser = buildDiagnosticCopyText({
      appVersion: null,
      errorCode: "P30-APP-20260804-0000",
      messageSafe: "x",
      occurredAt: "x",
      operation: "x",
      route: null,
    });
    expect(withoutBrowser).not.toContain("Navegador:");

    const withBrowser = buildDiagnosticCopyText({
      appVersion: null,
      errorCode: "P30-APP-20260804-0000",
      messageSafe: "x",
      occurredAt: "x",
      operation: "x",
      route: null,
      userAgent: "Mozilla/5.0",
    });
    expect(withBrowser).toContain("Navegador: Mozilla/5.0");
  });
});
