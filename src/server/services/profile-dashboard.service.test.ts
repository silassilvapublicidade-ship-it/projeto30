import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...pathSegments: string[]) {
  return readFileSync(join(process.cwd(), ...pathSegments), "utf8");
}

/** Slices from a top-level `export ...` declaration up to the next one - safe against multi-line parameter types that contain their own "\n}". */
function sliceDeclaration(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  const end = source.indexOf("\nexport ", start + marker.length);
  return source.slice(start, end === -1 ? undefined : end);
}

describe("profile-dashboard.service.ts - overview (Parte 4/17)", () => {
  const source = readSource("src", "server", "services", "profile-dashboard.service.ts");

  it("uses a single aggregated RPC for header + metrics + challenges, never separate N+1 queries", () => {
    expect(source).toContain('supabase.rpc("member_profile_overview")');
  });

  it("requires an authenticated session before touching data", () => {
    const fnBody = sliceDeclaration(source, "export async function getProfileOverview");
    expect(fnBody).toContain('await requireAuthUser("/app/perfil");');
  });

  it("returns a fully zeroed overview (never an error page) when the RPC fails - empty states must stay honest, not broken", () => {
    expect(source).toContain("if (error || !data) {\n    return EMPTY_OVERVIEW;\n  }");
    expect(source).toContain("achievementsUnlocked: 0");
    expect(source).toContain("daysFinalized: 0");
  });
});

describe("profile-dashboard.service.ts - timeline (Parte 7/8/17)", () => {
  const source = readSource("src", "server", "services", "profile-dashboard.service.ts");

  it("pages through the composite cursor RPC, never fetches the whole event history", () => {
    const fnBody = sliceDeclaration(source, "export async function getProfileTimeline");
    expect(fnBody).toContain('supabase.rpc("member_profile_timeline"');
    expect(fnBody).toContain("p_cursor_at: options.cursorAt");
    expect(fnBody).toContain("p_cursor_id: options.cursorId");
  });

  it("defaults the page size instead of trusting an unbounded caller-supplied limit", () => {
    expect(source).toContain("p_limit: options.limit ?? 20");
  });

  it("filters event types and challenge server-side via RPC params, never client-side", () => {
    expect(source).toContain("p_challenge_id: options.challengeId");
    expect(source).toContain("p_types: options.types");
  });
});

describe("profile-dashboard.service.ts - day-over-day highlight (Parte 5)", () => {
  const source = readSource("src", "server", "services", "profile-dashboard.service.ts");
  const fnBody = sliceDeclaration(source, "export async function getPrimaryEnrollmentDayOverDayMessage");

  it("only compares two FINALIZED logs - never today's in-progress state", () => {
    expect(fnBody).toContain('.eq("status", "finalized")');
  });

  it("never fabricates a comparison when either side is missing", () => {
    expect(fnBody).toContain("if (!todayLog || !yesterdayLog) {\n    return null;\n  }");
  });

  it("does not call ensure_today_daily_log - that side effect stays exclusive to the Hoje screen", () => {
    expect(fnBody).not.toContain("ensure_today_daily_log");
  });
});

describe("profile-dashboard.service.ts - recent evolution (Parte 11)", () => {
  const source = readSource("src", "server", "services", "profile-dashboard.service.ts");
  const fnBody = sliceDeclaration(source, "export async function getRecentEvolutionDays");

  it("scopes the query to a single enrollment - never the member's full daily_logs history", () => {
    expect(fnBody).toContain('.eq("enrollment_id", input.enrollmentId)');
  });

  it("bounds the query by a date range instead of loading every log and slicing in JS", () => {
    expect(fnBody).toContain(".gte(\"log_date\", startDate)");
    expect(fnBody).toContain(".lte(\"log_date\", today)");
  });
});

describe("profile-dashboard.service.ts - faith message (Parte 13/18)", () => {
  const source = readSource("src", "server", "services", "profile-dashboard.service.ts");
  const fnBody = sliceDeclaration(source, "export async function getFaithMessage");

  it("goes through the minimal member_pick_faith_message RPC instead of reading the admin-only table directly", () => {
    expect(fnBody).toContain('supabase.rpc("member_pick_faith_message")');
  });

  it("never renders a partial message - both title and body are required", () => {
    expect(fnBody).toContain("return raw.title && raw.body ? raw : null;");
  });
});
