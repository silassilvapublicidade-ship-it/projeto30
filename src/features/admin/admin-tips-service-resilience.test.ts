import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

/**
 * Regression coverage for a real gap found while investigating "Algo não
 * carregou" on /admin/dicas: supabase-js resolves query-level errors as
 * { data: null, error }, but a network-level failure (fetch rejecting) is a
 * genuine thrown exception. Left unguarded, that exception bypasses the
 * page's own error handling and crashes the whole /admin route tree via the
 * generic error boundary, with nothing logged anywhere. These functions must
 * never let an unexpected throw escape uncaught.
 */
describe("admin-tips.service - unexpected failures never escape uncaught", () => {
  const source = readSource("src", "server", "services", "admin-tips.service.ts");

  it("defines an internal error code for server-side log correlation", () => {
    expect(source).toContain('export const ADMIN_TIPS_LOAD_FAILED = "ADMIN_TIPS_LOAD_FAILED";');
  });

  it("logs failures without leaking secrets (never logs the raw error object or a service key)", () => {
    const loggerStart = source.indexOf("function logUnexpectedFailure");
    const loggerBody = source.slice(loggerStart, loggerStart + 500);
    expect(loggerBody).toContain("console.error");
    expect(loggerBody).not.toContain("service_role");
    expect(loggerBody).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  for (const fnName of ["listAdminTips", "getAdminTipById"]) {
    it(`${fnName} wraps its Supabase call in try/catch and returns the AdminServiceResult shape on failure`, () => {
      const start = source.indexOf(`export async function ${fnName}`);
      expect(start, `${fnName} should exist`).toBeGreaterThan(-1);
      const nextExportStart = source.indexOf("\nexport ", start + 1);
      const body = source.slice(start, nextExportStart === -1 ? undefined : nextExportStart);

      expect(body, `${fnName} should have a try block`).toMatch(/\btry\s*\{/);
      expect(body, `${fnName} should catch and convert to a safe error`).toContain(
        `logUnexpectedFailure("${fnName}",`,
      );
      expect(body, `${fnName} should return the null-data error shape on catch`).toMatch(
        /catch \(caughtError\) \{\s*return \{ data: null, error: logUnexpectedFailure/,
      );
    });
  }

  it("listChallengesForTipPicker degrades to an empty list instead of crashing the tip form", () => {
    const start = source.indexOf("export async function listChallengesForTipPicker");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\nexport async function getAdminTipById"));

    expect(body).toMatch(/\btry\s*\{/);
    expect(body).toContain('logUnexpectedFailure("listChallengesForTipPicker"');
    // both the query-error branch and the catch branch must return [], never throw
    const returnStatements = body.match(/return \[\];/g) ?? [];
    expect(returnStatements.length).toBeGreaterThanOrEqual(2);
  });
});

describe("admin/error.tsx - diagnosable without leaking details to the user", () => {
  const source = readSource("src", "app", "admin", "error.tsx");

  it("logs the error with route and digest context instead of swallowing it silently", () => {
    expect(source).toContain("console.error(");
    expect(source).toContain("pathname");
    expect(source).toContain("error.digest");
  });

  it("never renders the raw error message or stack trace to the user", () => {
    expect(source).not.toMatch(/\{error\.message\}/);
    expect(source).not.toMatch(/\{error\.stack\}/);
  });

  it("retry button prefers unstable_retry (re-fetches) over reset (does not re-fetch)", () => {
    const buttonStart = source.indexOf("<Button");
    const buttonTag = source.slice(buttonStart, source.indexOf(">", buttonStart));
    expect(buttonTag).toContain("onClick={unstable_retry ?? reset}");
  });
});
