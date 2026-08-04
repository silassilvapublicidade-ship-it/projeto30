import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

describe("reportClientErrorAction - the only client -> Observabilidade entry point", () => {
  const source = readSource("src", "features", "observability", "report-client-error.actions.ts");

  it("is a server action", () => {
    expect(source.trimStart().startsWith('"use server";')).toBe(true);
  });

  it("always uses warning severity - the client never gets to choose severity", () => {
    const start = source.indexOf("export async function reportClientErrorAction");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain('severity: "warning"');
    expect(body).not.toMatch(/severity:\s*input\./);
  });

  it("falls back to the generic 'app' area for any value the client sends that is not a real area", () => {
    const start = source.indexOf("export async function reportClientErrorAction");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain('isSystemErrorArea(input.area) ? input.area : "app"');
  });

  it("resolves the acting user without ever throwing or redirecting (error boundaries must never fail harder)", () => {
    const start = source.indexOf("export async function reportClientErrorAction");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toContain("getOptionalAuthUser().catch(() => null)");
  });
});

describe("Wired into both error.tsx boundaries", () => {
  it("admin/error.tsx calls reportClientErrorAction with area 'admin'", () => {
    const source = readSource("src", "app", "admin", "error.tsx");
    expect(source).toContain('import { reportClientErrorAction }');
    expect(source).toContain("void reportClientErrorAction({");
    expect(source).toContain('area: "admin"');
  });

  it("the member workspace error.tsx calls reportClientErrorAction with area 'app'", () => {
    const source = readSource("src", "app", "(member)", "app", "(workspace)", "error.tsx");
    expect(source).toContain('import { reportClientErrorAction }');
    expect(source).toContain("void reportClientErrorAction({");
    expect(source).toContain('area: "app"');
  });

  it("neither boundary renders the raw error message to the user, only logs/reports it", () => {
    for (const path of [
      ["src", "app", "admin", "error.tsx"],
      ["src", "app", "(member)", "app", "(workspace)", "error.tsx"],
    ]) {
      const source = readSource(...path);
      expect(source).not.toMatch(/\{error\.message\}/);
    }
  });
});
