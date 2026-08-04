import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource() {
  return readFileSync(join(process.cwd(), "src", "server", "services", "system-observability.service.ts"), "utf8");
}

describe("recordSystemError - never breaks the caller", () => {
  const source = readSource();
  const fnBody = source.slice(
    source.indexOf("export async function recordSystemError"),
    source.indexOf("\n}\n", source.indexOf("export async function recordSystemError")),
  );

  it("wraps the whole body in try/catch and only ever logs on failure - never rethrows", () => {
    expect(fnBody).toContain("try {");
    expect(fnBody).toContain("} catch (unexpected) {");
    expect(fnBody).toContain('console.error("[system-error-record-failed] unexpected", unexpected);');
    expect(fnBody).not.toMatch(/throw /);
  });

  it("sanitizes operation and message and refuses to record if either is empty or still forbidden after sanitizing", () => {
    expect(fnBody).toContain("sanitizeErrorText(input.operation, 120)");
    expect(fnBody).toContain("sanitizeErrorText(input.message, 500)");
    expect(fnBody).toContain("containsForbiddenPattern(operation) || containsForbiddenPattern(message)");
  });

  it("sanitizes metadata through the shared whitelist function before ever building the RPC call", () => {
    expect(fnBody).toContain("sanitizeMetadata(input.metadata)");
  });

  it("uses the service-role admin client, never the request-scoped session client, matching the RPC's service_role-only grant", () => {
    expect(fnBody).toContain("createSupabaseAdminClient()");
    expect(fnBody).not.toContain("createSupabaseServerClient()");
  });

  it("stamps the current deploy's short commit SHA as app_version when available", () => {
    expect(fnBody).toContain("getDeployInfo().commitShaShort");
  });
});

describe("getSystemHealthOverview / listSystemErrorEvents / getSystemErrorEvent / resolveSystemErrorEvent - read/write via RLS-respecting client", () => {
  const source = readSource();

  it("all four use the request-scoped server client (never service_role) - permission checks happen inside the RPCs via auth.uid()", () => {
    for (const fnName of [
      "getSystemHealthOverview",
      "listSystemErrorEvents",
      "getSystemErrorEvent",
      "resolveSystemErrorEvent",
    ]) {
      const start = source.indexOf(`export async function ${fnName}`);
      expect(start, `${fnName} should exist`).toBeGreaterThan(-1);
      const body = source.slice(start, source.indexOf("\n}\n", start));
      expect(body, `${fnName} should use createSupabaseServerClient()`).toContain("createSupabaseServerClient()");
    }
  });

  it("listSystemErrorEvents omits unset filter keys instead of sending null - avoids fighting the RPC's default-null args", () => {
    const start = source.indexOf("export async function listSystemErrorEvents");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain("...(filters.area ? { p_area: filters.area } : {})");
  });

  it("resolveSystemErrorEvent surfaces the 42501 (not super_admin) error as a friendly message, not the raw Postgres error", () => {
    const start = source.indexOf("export async function resolveSystemErrorEvent");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain('error.code === "42501"');
    expect(body).toContain("Apenas super administradores podem alterar o status");
  });
});
